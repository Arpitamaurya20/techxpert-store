import { storePool } from '../db/mysql.js';
import { mysqlOrFileStore } from '../db/mysqlErrors.js';
import { orderRefusal } from '../utils/checkoutPricing.js';
import { areaCodeFor, normalizePincode } from '../utils/pincode.js';

export type PincodeCheck = {
  pincode: string;
  serviceable: boolean;
  areaName: string | null;
  message: string;
};

export type DeliveryPincode = {
  id: string;
  pincode: string;
  areaName: string;
  active: boolean;
  updatedAt: string | null;
};

/** Districts are not used for delivery; new areas go under the first one on file. */
async function defaultDistrictId(): Promise<number> {
  const [rows] = await storePool.query<any[]>(`SELECT ID FROM districts ORDER BY ID ASC LIMIT 1`);
  if (!rows.length) throw orderRefusal(409, 'Add a district before adding delivery pincodes.');
  return Number(rows[0].ID);
}

export class DeliveryAreaService {
  static async check(raw: unknown): Promise<PincodeCheck> {
    const pincode = normalizePincode(raw);
    if (!pincode) throw orderRefusal(400, 'Enter a 6-digit pincode.');
    try {
      const [rows] = await storePool.query<any[]>(
        `SELECT a.AreaName as areaName
         FROM pincodes p LEFT JOIN areas a ON a.ID = p.AreaID
         WHERE p.Pincode = ? AND p.IsActive = 1
         ORDER BY p.ID ASC`,
        [pincode]
      );
      if (!rows.length) {
        return { pincode, serviceable: false, areaName: null, message: `We don't deliver to ${pincode} yet.` };
      }
      const areaName = rows.map((r) => r.areaName).filter(Boolean).join(', ') || null;
      return {
        pincode,
        serviceable: true,
        areaName,
        message: areaName ? `We deliver to ${areaName} (${pincode}).` : `We deliver to ${pincode}.`,
      };
    } catch (err) {
      return mysqlOrFileStore('delivery.check', err, () => ({
        pincode,
        serviceable: true,
        areaName: null,
        message: `Demo mode: ${pincode} is treated as deliverable.`,
      }));
    }
  }

  /** Refuses an order whose pincode is missing or not served. */
  static async assertServiceable(pincode: string | null): Promise<string> {
    if (!pincode) throw orderRefusal(400, 'Add a 6-digit pincode to the delivery address.');
    const result = await DeliveryAreaService.check(pincode);
    if (!result.serviceable) throw orderRefusal(409, result.message);
    return result.pincode;
  }

  static async list(): Promise<DeliveryPincode[]> {
    const [rows] = await storePool.query<any[]>(
      `SELECT p.ID as id, p.Pincode as pincode, COALESCE(a.AreaName, '') as areaName, p.IsActive as active,
              DATE_FORMAT(COALESCE(p.UpdatedDate, p.CreatedDate), '%Y-%m-%d') as day,
              COALESCE(p.UpdatedTime, p.CreatedTime) as time
       FROM pincodes p LEFT JOIN areas a ON a.ID = p.AreaID
       ORDER BY p.Pincode ASC, p.ID ASC`
    );
    return rows.map((r) => ({
      id: String(r.id),
      pincode: String(r.pincode),
      areaName: String(r.areaName),
      active: Number(r.active) === 1,
      updatedAt: r.day ? `${r.day}T${r.time || '00:00:00'}` : null,
    }));
  }

  /** Adds (or re-opens) a pincode under an area with this name. */
  static async add(input: { pincode: unknown; areaName: unknown }, adminId?: number): Promise<DeliveryPincode> {
    const pincode = normalizePincode(input.pincode);
    if (!pincode) throw orderRefusal(400, 'Enter a 6-digit pincode.');
    const areaName = String(input.areaName ?? '').trim().replace(/\s+/g, ' ');
    if (areaName.length < 2 || areaName.length > 120) {
      throw orderRefusal(400, 'Area name must be 2–120 characters.');
    }

    const [existing] = await storePool.query<any[]>(
      `SELECT ID FROM pincodes WHERE Pincode = ? ORDER BY ID ASC LIMIT 1`,
      [pincode]
    );
    if (existing.length) {
      throw orderRefusal(409, `${pincode} is already on the list. Resume it instead of adding it again.`);
    }

    const conn = await storePool.getConnection();
    try {
      await conn.beginTransaction();
      const [areas] = await conn.query<any[]>(
        `SELECT ID FROM areas WHERE LOWER(AreaName) = LOWER(?) ORDER BY ID ASC LIMIT 1`,
        [areaName]
      );
      let areaId: number;
      if (areas.length) {
        areaId = Number(areas[0].ID);
      } else {
        const districtId = await defaultDistrictId();
        const [res] = await conn.query<any>(
          `INSERT INTO areas (DistrictID, AreaCode, AreaName, IsActive, CreatedDate, CreatedTime, CreatedBy)
           VALUES (?, ?, ?, 1, CURDATE(), CURTIME(), ?)`,
          [districtId, areaCodeFor(pincode), areaName, adminId ?? null]
        );
        areaId = Number(res.insertId);
      }
      const [res] = await conn.query<any>(
        `INSERT INTO pincodes (AreaID, Pincode, IsActive, CreatedDate, CreatedTime, CreatedBy)
         VALUES (?, ?, 1, CURDATE(), CURTIME(), ?)`,
        [areaId, pincode, adminId ?? null]
      );
      await conn.commit();
      return { id: String(res.insertId), pincode, areaName, active: true, updatedAt: new Date().toISOString() };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /** Pause or resume delivery to a pincode. There is no delete. */
  static async setActive(id: number, active: boolean, adminId?: number): Promise<DeliveryPincode> {
    const [res] = await storePool.query<any>(
      `UPDATE pincodes SET IsActive = ?, UpdatedDate = CURDATE(), UpdatedTime = CURTIME(), UpdatedBy = ? WHERE ID = ?`,
      [active ? 1 : 0, adminId ?? null, id]
    );
    if (!res.affectedRows) throw orderRefusal(404, 'Pincode not found');
    const row = (await DeliveryAreaService.list()).find((p) => p.id === String(id));
    if (!row) throw orderRefusal(404, 'Pincode not found');
    return row;
  }
}
