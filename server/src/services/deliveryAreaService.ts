import { storePool } from '../db/mysql.js';
import { mysqlOrFileStore } from '../db/mysqlErrors.js';
import { orderRefusal } from '../utils/checkoutPricing.js';
import { areaCodeFor, normalizePincode } from '../utils/pincode.js';
import { coversStore, storeFilter, type Scope } from '../utils/scope.js';

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
  storeId: number | null;
  storeName: string | null;
  updatedAt: string | null;
};

const LIST_SQL = `
  SELECT p.ID as id, p.Pincode as pincode, COALESCE(a.AreaName, '') as areaName, p.IsActive as active,
         s.ID as storeId, s.StoreName as storeName,
         DATE_FORMAT(COALESCE(p.UpdatedDate, p.CreatedDate), '%Y-%m-%d') as day,
         COALESCE(p.UpdatedTime, p.CreatedTime) as time
  FROM pincodes p
  LEFT JOIN areas a ON a.ID = p.AreaID
  LEFT JOIN store_pincodes sp ON sp.PincodeID = p.ID AND sp.IsActive = 1
  LEFT JOIN stores s ON s.ID = sp.StoreID`;

function toDeliveryPincode(r: any): DeliveryPincode {
  return {
    id: String(r.id),
    pincode: String(r.pincode),
    areaName: String(r.areaName),
    active: Number(r.active) === 1,
    storeId: r.storeId == null ? null : Number(r.storeId),
    storeName: r.storeName == null ? null : String(r.storeName),
    updatedAt: r.day ? `${r.day}T${r.time || '00:00:00'}` : null,
  };
}

/** Districts are not used for delivery; new areas go under the first one on file. */
async function defaultDistrictId(): Promise<number> {
  const [rows] = await storePool.query<any[]>(`SELECT ID FROM districts ORDER BY ID ASC LIMIT 1`);
  if (!rows.length) throw orderRefusal(409, 'Add a district before adding delivery pincodes.');
  return Number(rows[0].ID);
}

/** Served = the pincode is on the list and an active store is linked to it. */
async function servedBy(pincode: string): Promise<{ areaName: string | null; storeId: number }[]> {
  const [rows] = await storePool.query<any[]>(
    `SELECT a.AreaName as areaName, s.ID as storeId
     FROM pincodes p
     LEFT JOIN areas a ON a.ID = p.AreaID
     JOIN store_pincodes sp ON sp.PincodeID = p.ID AND sp.IsActive = 1
     JOIN stores s ON s.ID = sp.StoreID AND s.IsActive = 1
     WHERE p.Pincode = ? AND p.IsActive = 1
     ORDER BY p.ID ASC`,
    [pincode]
  );
  return rows.map((r) => ({ areaName: r.areaName ? String(r.areaName) : null, storeId: Number(r.storeId) }));
}

export class DeliveryAreaService {
  static async check(raw: unknown): Promise<PincodeCheck> {
    const pincode = normalizePincode(raw);
    if (!pincode) throw orderRefusal(400, 'Enter a 6-digit pincode.');
    try {
      const rows = await servedBy(pincode);
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

  /** Refuses an order whose pincode is missing or not served; otherwise the store that serves it. */
  static async assertServiceable(raw: string | null): Promise<{ pincode: string; storeId: number }> {
    const pincode = normalizePincode(raw);
    if (!pincode) throw orderRefusal(400, 'Add a 6-digit pincode to the delivery address.');
    const rows = await servedBy(pincode);
    if (!rows.length) throw orderRefusal(409, `We don't deliver to ${pincode} yet.`);
    return { pincode, storeId: rows[0].storeId };
  }

  /** Pincodes whose store is inside the scope; whole company also sees pincodes with no store. */
  static async list(scope: Scope): Promise<DeliveryPincode[]> {
    const stores = storeFilter(scope);
    if (stores && !stores.length) return [];
    const [rows] = await storePool.query<any[]>(
      `${LIST_SQL} ${stores ? 'WHERE s.ID IN (?)' : ''} ORDER BY p.Pincode ASC, p.ID ASC`,
      stores ? [stores] : []
    );
    return rows.map(toDeliveryPincode);
  }

  private static async one(id: number): Promise<DeliveryPincode | null> {
    const [rows] = await storePool.query<any[]>(`${LIST_SQL} WHERE p.ID = ?`, [id]);
    return rows.length ? toDeliveryPincode(rows[0]) : null;
  }

  /**
   * Adds a pincode under an area with this name, served by `storeId`. Staff limited to some places
   * must name one of their stores; whole-company staff may leave it for linking under Stores.
   */
  static async add(
    input: { pincode: unknown; areaName: unknown; storeId?: unknown },
    scope: Scope,
    adminId?: number
  ): Promise<DeliveryPincode> {
    const pincode = normalizePincode(input.pincode);
    if (!pincode) throw orderRefusal(400, 'Enter a 6-digit pincode.');
    const areaName = String(input.areaName ?? '').trim().replace(/\s+/g, ' ');
    if (areaName.length < 2 || areaName.length > 120) {
      throw orderRefusal(400, 'Area name must be 2–120 characters.');
    }
    const rawStore = input.storeId;
    const storeId = rawStore == null || rawStore === '' ? null : Number(rawStore);
    if (storeId !== null && (!Number.isInteger(storeId) || storeId <= 0)) {
      throw orderRefusal(400, 'Choose a store, or none.');
    }
    if (storeId === null && !scope.all) throw orderRefusal(400, 'Choose which of your stores serves this pincode.');
    if (storeId !== null) {
      if (!coversStore(scope, storeId)) throw orderRefusal(403, 'That store is outside your places.');
      const [stores] = await storePool.query<any[]>(`SELECT IsActive as active FROM stores WHERE ID = ?`, [storeId]);
      if (!stores.length) throw orderRefusal(404, 'That store no longer exists.');
      if (Number(stores[0].active) !== 1) throw orderRefusal(409, 'That store is inactive. Choose another.');
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
      if (storeId !== null) {
        await conn.query(`INSERT INTO store_pincodes (StoreID, PincodeID, CreatedBy) VALUES (?, ?, ?)`, [
          storeId,
          Number(res.insertId),
          adminId ?? null,
        ]);
      }
      await conn.commit();
      return (await DeliveryAreaService.one(Number(res.insertId)))!;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /** Pause or resume delivery to a pincode. There is no delete. */
  static async setActive(id: number, active: boolean, scope: Scope, adminId?: number): Promise<DeliveryPincode> {
    const before = Number.isInteger(id) && id > 0 ? await DeliveryAreaService.one(id) : null;
    const visible = before && (scope.all || (before.storeId != null && coversStore(scope, before.storeId)));
    if (!visible) throw orderRefusal(404, 'Pincode not found');
    await storePool.query(
      `UPDATE pincodes SET IsActive = ?, UpdatedDate = CURDATE(), UpdatedTime = CURTIME(), UpdatedBy = ? WHERE ID = ?`,
      [active ? 1 : 0, adminId ?? null, id]
    );
    return (await DeliveryAreaService.one(id))!;
  }
}
