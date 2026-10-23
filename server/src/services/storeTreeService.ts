import { storePool } from '../db/mysql.js';
import { AuditService } from './auditService.js';
import { loadStoreTree, type AccessActor } from './accessService.js';
import { normalizePincode } from '../utils/pincode.js';
import { optionalString, requireString } from '../utils/validate.js';
import { coversGroup, coversStore, placementRefusal } from '../utils/scope.js';

export type StoreGroup = { id: number; name: string; kind: string; parentId: number | null };

export type StoreSummary = {
  id: number;
  code: string;
  name: string;
  groupId: number | null;
  active: boolean;
  contactNumber: string;
  email: string;
  address: string;
  pincodeCount: number;
};

export type StorePincodeLink = {
  linkId: number;
  pincodeId: number;
  pincode: string;
  areaName: string;
  active: boolean;
  deliveryActive: boolean;
  updatedAt: string | null;
};

function refusal(statusCode: number, message: string) {
  return Object.assign(new Error(message), { statusCode });
}

async function audit(actor: AccessActor, action: string, details: string) {
  try {
    await AuditService.create({
      action,
      entity: 'store',
      details,
      user: `${actor.name} (${actor.access.roleName ?? 'no role'})`,
    });
  } catch (err) {
    console.warn('[StoreTreeService] audit write failed', err);
  }
}

/** `undefined` = not sent; `null` = top level; otherwise a group id. */
function parentField(value: unknown, field: string): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw refusal(400, `${field} must be a group id or empty for the top level.`);
  return id;
}

function cleanGroupName(value: unknown): string {
  const name = requireString(value, 'Group name', { min: 2, max: 80 }).replace(/\s+/g, ' ');
  return name;
}

function placeLabel(groupId: number | null, names: Map<number, string>): string {
  return groupId == null ? 'the top level' : `"${names.get(groupId) ?? `group ${groupId}`}"`;
}

async function groupNames(): Promise<Map<number, string>> {
  const [rows] = await storePool.query<any[]>(`SELECT ID as id, Name as name FROM store_groups`);
  return new Map(rows.map((r) => [Number(r.id), String(r.name)]));
}

async function findStore(storeId: number) {
  if (!Number.isInteger(storeId) || storeId <= 0) return null;
  const [rows] = await storePool.query<any[]>(
    `SELECT s.ID as id, s.StoreName as name, s.IsActive as active, g.GroupID as groupId
     FROM stores s LEFT JOIN store_group_stores g ON g.StoreID = s.ID WHERE s.ID = ?`,
    [storeId]
  );
  const r = rows[0];
  return r
    ? { id: Number(r.id), name: String(r.name), active: Number(r.active) === 1, groupId: r.groupId == null ? null : Number(r.groupId) }
    : null;
}

function assertGroupInScope(actor: AccessActor, groupId: number | null, action: string) {
  if (coversGroup(actor.access.scope, groupId)) return;
  throw refusal(
    403,
    groupId == null
      ? `Only whole-company staff can ${action} at the top level.`
      : `That group is outside your places, so you can't ${action} there.`
  );
}

function assertStoreInScope(actor: AccessActor, storeId: number) {
  if (!coversStore(actor.access.scope, storeId)) throw refusal(403, 'That store is outside your places.');
}

function isDuplicate(err: any) {
  return err?.code === 'ER_DUP_ENTRY';
}

export class StoreTreeService {
  /** Groups and stores inside the actor's places (everything for whole company). */
  static async tree(actor: AccessActor): Promise<{ groups: StoreGroup[]; stores: StoreSummary[]; wholeCompany: boolean }> {
    const scope = actor.access.scope;
    const [groups] = await storePool.query<any[]>(
      `SELECT ID as id, Name as name, Kind as kind, ParentID as parentId FROM store_groups ORDER BY Name ASC`
    );
    const [stores] = await storePool.query<any[]>(
      `SELECT s.ID as id, s.StoreCode as code, s.StoreName as name, s.IsActive as active,
              s.ContactNumber as contactNumber, s.Email as email, s.Address as address, g.GroupID as groupId,
              (SELECT COUNT(*) FROM store_pincodes sp WHERE sp.StoreID = s.ID AND sp.IsActive = 1) as pincodeCount
       FROM stores s LEFT JOIN store_group_stores g ON g.StoreID = s.ID
       ORDER BY s.StoreName ASC`
    );
    return {
      wholeCompany: scope.all,
      groups: groups
        .filter((g) => coversGroup(scope, Number(g.id)))
        .map((g) => ({
          id: Number(g.id),
          name: String(g.name),
          kind: g.kind ? String(g.kind) : '',
          parentId: g.parentId == null ? null : Number(g.parentId),
        })),
      stores: stores
        .filter((s) => coversStore(scope, Number(s.id)))
        .map((s) => ({
          id: Number(s.id),
          code: String(s.code),
          name: String(s.name),
          groupId: s.groupId == null ? null : Number(s.groupId),
          active: Number(s.active) === 1,
          contactNumber: s.contactNumber ? String(s.contactNumber) : '',
          email: s.email ? String(s.email) : '',
          address: s.address ? String(s.address) : '',
          pincodeCount: Number(s.pincodeCount) || 0,
        })),
    };
  }

  static async createGroup(actor: AccessActor, body: any): Promise<StoreGroup> {
    const name = cleanGroupName(body?.name);
    const kind = optionalString(body?.kind, 'Kind', { max: 40 }) ?? '';
    const parentId = parentField(body?.parentId, 'parentId') ?? null;
    assertGroupInScope(actor, parentId, 'add groups');
    const tree = await loadStoreTree();
    const problem = placementRefusal(null, parentId, tree.groups);
    if (problem) throw refusal(409, problem);
    try {
      const [res] = await storePool.query<any>(
        `INSERT INTO store_groups (Name, Kind, ParentID, CreatedBy) VALUES (?, ?, ?, ?)`,
        [name, kind || null, parentId, actor.staffId]
      );
      const names = await groupNames();
      await audit(actor, 'Created Group', `Created group "${name}" under ${placeLabel(parentId, names)}`);
      return { id: Number(res.insertId), name, kind, parentId };
    } catch (err) {
      if (isDuplicate(err)) throw refusal(409, `There is already a group called "${name}" there.`);
      throw err;
    }
  }

  static async updateGroup(actor: AccessActor, groupId: number, body: any): Promise<StoreGroup> {
    const [rows] = await storePool.query<any[]>(
      `SELECT ID as id, Name as name, Kind as kind, ParentID as parentId FROM store_groups WHERE ID = ?`,
      [groupId]
    );
    const existing = rows[0];
    if (!existing) throw refusal(404, 'That group no longer exists.');
    assertGroupInScope(actor, groupId, 'change groups');

    const name = body?.name !== undefined ? cleanGroupName(body.name) : String(existing.name);
    const kind = body?.kind !== undefined ? optionalString(body.kind, 'Kind', { max: 40 }) ?? '' : existing.kind ?? '';
    const currentParent = existing.parentId == null ? null : Number(existing.parentId);
    const requestedParent = parentField(body?.parentId, 'parentId');
    const parentId = requestedParent === undefined ? currentParent : requestedParent;
    if (parentId !== currentParent) {
      assertGroupInScope(actor, parentId, 'move groups');
      const problem = placementRefusal(groupId, parentId, (await loadStoreTree()).groups);
      if (problem) throw refusal(409, problem);
    }

    try {
      await storePool.query(
        `UPDATE store_groups SET Name = ?, Kind = ?, ParentID = ?, UpdatedBy = ? WHERE ID = ?`,
        [name, kind || null, parentId, actor.staffId, groupId]
      );
    } catch (err) {
      if (isDuplicate(err)) throw refusal(409, `There is already a group called "${name}" there.`);
      throw err;
    }
    const names = await groupNames();
    const changes = [
      name !== existing.name ? `renamed from "${existing.name}"` : '',
      parentId !== currentParent ? `moved to ${placeLabel(parentId, names)}` : '',
    ].filter(Boolean);
    if (changes.length || kind !== (existing.kind ?? '')) {
      await audit(actor, 'Updated Group', `Group "${name}"${changes.length ? `: ${changes.join(', ')}` : ''}`);
    }
    return { id: groupId, name, kind: kind ?? '', parentId };
  }

  static async deleteGroup(actor: AccessActor, groupId: number): Promise<{ success: true }> {
    const [rows] = await storePool.query<any[]>(`SELECT Name as name FROM store_groups WHERE ID = ?`, [groupId]);
    if (!rows.length) throw refusal(404, 'That group no longer exists.');
    assertGroupInScope(actor, groupId, 'delete groups');
    const name = String(rows[0].name);
    const [[counts]] = await storePool.query<any[]>(
      `SELECT (SELECT COUNT(*) FROM store_groups WHERE ParentID = ?) as childGroups,
              (SELECT COUNT(*) FROM store_group_stores WHERE GroupID = ?) as childStores,
              (SELECT COUNT(*) FROM portal_staff_scope WHERE NodeType = 'group' AND NodeID = ?) as staffCount`,
      [groupId, groupId, groupId]
    );
    if (Number(counts.childGroups) || Number(counts.childStores)) {
      throw refusal(
        409,
        `"${name}" still has ${counts.childGroups} group(s) and ${counts.childStores} store(s). Move them out first.`
      );
    }
    if (Number(counts.staffCount)) {
      throw refusal(409, `${counts.staffCount} staff cover "${name}". Change their places first.`);
    }
    try {
      await storePool.query(`DELETE FROM store_groups WHERE ID = ?`, [groupId]);
    } catch (err: any) {
      if (err?.code === 'ER_ROW_IS_REFERENCED_2') throw refusal(409, `Something was just added to "${name}". Try again.`);
      throw err;
    }
    await audit(actor, 'Deleted Group', `Deleted group "${name}"`);
    return { success: true };
  }

  /** A new store with its own address pincode, which must already be on the delivery list. */
  static async createStore(actor: AccessActor, body: any): Promise<StoreSummary> {
    const name = requireString(body?.name, 'Store name', { min: 2, max: 255 }).replace(/\s+/g, ' ');
    const groupId = parentField(body?.groupId, 'groupId') ?? null;
    assertGroupInScope(actor, groupId, 'add stores');
    if (groupId != null && !(await groupNames()).has(groupId)) throw refusal(404, 'That group no longer exists.');
    const pincode = normalizePincode(body?.pincode);
    if (!pincode) throw refusal(400, "Enter the store's own 6-digit pincode.");
    const contactNumber = optionalString(body?.contactNumber, 'Contact number', { max: 20 }) ?? null;
    const email = optionalString(body?.email, 'Email', { max: 255 }) ?? null;
    if (email && !email.includes('@')) throw refusal(400, 'Email must be an email address.');
    const address = optionalString(body?.address, 'Address', { max: 1000 }) ?? null;

    const [pins] = await storePool.query<any[]>(`SELECT ID as id FROM pincodes WHERE Pincode = ? ORDER BY ID ASC LIMIT 1`, [
      pincode,
    ]);
    if (!pins.length) throw refusal(409, `Add ${pincode} under Delivery Pincodes first.`);
    const pincodeId = Number(pins[0].id);

    const conn = await storePool.getConnection();
    let storeId = 0;
    let code = '';
    try {
      const [[lock]] = await conn.query<any[]>(`SELECT GET_LOCK('tx_store_id_gen', 10) as got`);
      if (Number(lock?.got) !== 1) throw refusal(503, 'Another store is being added. Try again.');
      await conn.beginTransaction();
      const [[next]] = await conn.query<any[]>(`SELECT COALESCE(MAX(ID), 0) + 1 as id FROM stores`);
      storeId = Number(next.id);
      code = `ST${String(storeId).padStart(4, '0')}`;
      const [landmark] = await conn.query<any>(
        `INSERT INTO landmarks (PincodeID, LandmarkCode, LandmarkName, Address, IsActive, CreatedDate, CreatedTime, CreatedBy)
         VALUES (?, ?, ?, ?, 1, CURDATE(), CURTIME(), ?)`,
        [pincodeId, `LM-${code}`, name, address, actor.staffId]
      );
      await conn.query(
        `INSERT INTO stores (ID, StoreCode, StoreName, LandmarkID, ContactNumber, Email, Address, IsActive, CreatedDate, CreatedTime, CreatedBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURDATE(), CURTIME(), ?)`,
        [storeId, code, name, Number(landmark.insertId), contactNumber, email, address, actor.staffId]
      );
      if (groupId != null) {
        await conn.query(`INSERT INTO store_group_stores (StoreID, GroupID, UpdatedBy) VALUES (?, ?, ?)`, [
          storeId,
          groupId,
          actor.staffId,
        ]);
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback().catch(() => undefined);
      if (isDuplicate(err)) throw refusal(409, 'A store with that code already exists. Try again.');
      throw err;
    } finally {
      await conn.query(`SELECT RELEASE_LOCK('tx_store_id_gen')`).catch(() => undefined);
      conn.release();
    }

    const names = await groupNames();
    await audit(actor, 'Created Store', `Created store "${name}" (${code}) in ${placeLabel(groupId, names)}`);
    return {
      id: storeId,
      code,
      name,
      groupId,
      active: true,
      contactNumber: contactNumber ?? '',
      email: email ?? '',
      address: address ?? '',
      pincodeCount: 0,
    };
  }

  /** Details, placement and active flag. Deactivating needs `stores` delete (checked by the route). */
  static async updateStore(actor: AccessActor, storeId: number, body: any): Promise<StoreSummary> {
    const store = await findStore(storeId);
    if (!store) throw refusal(404, 'That store no longer exists.');
    assertStoreInScope(actor, storeId);

    const sets: string[] = [];
    const values: unknown[] = [];
    const changes: string[] = [];
    if (body?.name !== undefined) {
      const name = requireString(body.name, 'Store name', { min: 2, max: 255 }).replace(/\s+/g, ' ');
      if (name !== store.name) changes.push(`renamed from "${store.name}"`);
      sets.push('StoreName = ?');
      values.push(name);
    }
    if (body?.contactNumber !== undefined) {
      sets.push('ContactNumber = ?');
      values.push(optionalString(body.contactNumber, 'Contact number', { max: 20 }) ?? null);
    }
    if (body?.email !== undefined) {
      const email = optionalString(body.email, 'Email', { max: 255 }) ?? null;
      if (email && !email.includes('@')) throw refusal(400, 'Email must be an email address.');
      sets.push('Email = ?');
      values.push(email);
    }
    if (body?.address !== undefined) {
      sets.push('Address = ?');
      values.push(optionalString(body.address, 'Address', { max: 1000 }) ?? null);
    }
    if (body?.active !== undefined) {
      if (typeof body.active !== 'boolean') throw refusal(400, 'active must be true or false');
      if (!body.active && store.active) {
        const [[links]] = await storePool.query<any[]>(
          `SELECT COUNT(*) as n FROM store_pincodes WHERE StoreID = ? AND IsActive = 1`,
          [storeId]
        );
        if (Number(links.n)) {
          throw refusal(409, `"${store.name}" still serves ${links.n} pincode(s). Move them to another store first.`);
        }
      }
      if (body.active !== store.active) changes.push(body.active ? 'reactivated' : 'deactivated');
      sets.push('IsActive = ?');
      values.push(body.active ? 1 : 0);
    }

    const groupId = parentField(body?.groupId, 'groupId');
    const moving = groupId !== undefined && groupId !== store.groupId;
    if (moving) {
      assertGroupInScope(actor, groupId, 'move stores');
      if (groupId != null && !(await groupNames()).has(groupId)) throw refusal(404, 'That group no longer exists.');
    }

    const conn = await storePool.getConnection();
    try {
      await conn.beginTransaction();
      if (sets.length) {
        await conn.query(
          `UPDATE stores SET ${sets.join(', ')}, UpdatedDate = CURDATE(), UpdatedTime = CURTIME(), UpdatedBy = ? WHERE ID = ?`,
          [...values, actor.staffId, storeId]
        );
      }
      if (moving) {
        if (groupId == null) {
          await conn.query(`DELETE FROM store_group_stores WHERE StoreID = ?`, [storeId]);
        } else {
          await conn.query(
            `INSERT INTO store_group_stores (StoreID, GroupID, UpdatedBy) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE GroupID = VALUES(GroupID), UpdatedBy = VALUES(UpdatedBy)`,
            [storeId, groupId, actor.staffId]
          );
        }
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    if (moving) changes.push(`moved to ${placeLabel(groupId ?? null, await groupNames())}`);
    const updated = (await StoreTreeService.tree(actor)).stores.find((s) => s.id === storeId)!;
    await audit(
      actor,
      'Updated Store',
      `Store "${updated.name}"${changes.length ? `: ${changes.join(', ')}` : ': details changed'}`
    );
    return updated;
  }

  static async storePincodes(actor: AccessActor, storeId: number): Promise<StorePincodeLink[]> {
    if (!(await findStore(storeId))) throw refusal(404, 'That store no longer exists.');
    assertStoreInScope(actor, storeId);
    const [rows] = await storePool.query<any[]>(
      `SELECT sp.ID as linkId, p.ID as pincodeId, p.Pincode as pincode, COALESCE(a.AreaName, '') as areaName,
              sp.IsActive as active, p.IsActive as deliveryActive,
              DATE_FORMAT(COALESCE(sp.UpdatedAt, sp.CreatedAt), '%Y-%m-%dT%H:%i:%s') as updatedAt
       FROM store_pincodes sp
       JOIN pincodes p ON p.ID = sp.PincodeID
       LEFT JOIN areas a ON a.ID = p.AreaID
       WHERE sp.StoreID = ?
       ORDER BY sp.IsActive DESC, p.Pincode ASC, sp.ID DESC`,
      [storeId]
    );
    return rows.map((r) => ({
      linkId: Number(r.linkId),
      pincodeId: Number(r.pincodeId),
      pincode: String(r.pincode),
      areaName: String(r.areaName),
      active: Number(r.active) === 1,
      deliveryActive: Number(r.deliveryActive) === 1,
      updatedAt: r.updatedAt ? String(r.updatedAt) : null,
    }));
  }

  /** Makes this store serve the pincode, taking it from another store if needed. */
  static async linkPincode(actor: AccessActor, storeId: number, body: any): Promise<StorePincodeLink[]> {
    const store = await findStore(storeId);
    if (!store) throw refusal(404, 'That store no longer exists.');
    assertStoreInScope(actor, storeId);
    if (!store.active) throw refusal(409, `Reactivate "${store.name}" before giving it pincodes.`);
    const pincode = normalizePincode(body?.pincode);
    if (!pincode) throw refusal(400, 'Enter a 6-digit pincode.');
    const [pins] = await storePool.query<any[]>(`SELECT ID as id FROM pincodes WHERE Pincode = ? ORDER BY ID ASC LIMIT 1`, [
      pincode,
    ]);
    if (!pins.length) throw refusal(409, `Add ${pincode} under Delivery Pincodes first.`);
    const pincodeId = Number(pins[0].id);

    const conn = await storePool.getConnection();
    let from: { id: number; name: string } | null = null;
    try {
      await conn.beginTransaction();
      const [current] = await conn.query<any[]>(
        `SELECT sp.ID as linkId, s.ID as storeId, s.StoreName as storeName
         FROM store_pincodes sp JOIN stores s ON s.ID = sp.StoreID
         WHERE sp.PincodeID = ? AND sp.IsActive = 1 FOR UPDATE`,
        [pincodeId]
      );
      const held = current[0];
      if (held && Number(held.storeId) === storeId) throw refusal(409, `${pincode} is already served by "${store.name}".`);
      if (held) {
        from = { id: Number(held.storeId), name: String(held.storeName) };
        if (!coversStore(actor.access.scope, from.id)) {
          throw refusal(403, `${pincode} is served by "${from.name}", which is outside your places.`);
        }
        await conn.query(`UPDATE store_pincodes SET IsActive = 0, UpdatedBy = ? WHERE ID = ?`, [
          actor.staffId,
          Number(held.linkId),
        ]);
      }
      await conn.query(`INSERT INTO store_pincodes (StoreID, PincodeID, CreatedBy) VALUES (?, ?, ?)`, [
        storeId,
        pincodeId,
        actor.staffId,
      ]);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      if (isDuplicate(err)) throw refusal(409, `${pincode} was just given to another store. Refresh and try again.`);
      throw err;
    } finally {
      conn.release();
    }
    await audit(
      actor,
      from ? 'Moved Pincode' : 'Linked Pincode',
      from ? `${pincode} moved from "${from.name}" to "${store.name}"` : `${pincode} now served by "${store.name}"`
    );
    return StoreTreeService.storePincodes(actor, storeId);
  }

  /** Stops this store serving the pincode. Orders to it are refused until another store takes it. */
  static async unlinkPincode(actor: AccessActor, storeId: number, pincodeId: number): Promise<StorePincodeLink[]> {
    const store = await findStore(storeId);
    if (!store) throw refusal(404, 'That store no longer exists.');
    assertStoreInScope(actor, storeId);
    const [rows] = await storePool.query<any[]>(
      `SELECT sp.ID as linkId, p.Pincode as pincode FROM store_pincodes sp JOIN pincodes p ON p.ID = sp.PincodeID
       WHERE sp.StoreID = ? AND sp.PincodeID = ? AND sp.IsActive = 1`,
      [storeId, pincodeId]
    );
    if (!rows.length) throw refusal(404, `"${store.name}" doesn't serve that pincode.`);
    await storePool.query(`UPDATE store_pincodes SET IsActive = 0, UpdatedBy = ? WHERE ID = ?`, [
      actor.staffId,
      Number(rows[0].linkId),
    ]);
    await audit(actor, 'Unlinked Pincode', `${rows[0].pincode} no longer served by "${store.name}"`);
    return StoreTreeService.storePincodes(actor, storeId);
  }
}
