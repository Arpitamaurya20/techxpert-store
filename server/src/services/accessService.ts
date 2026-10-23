import type { PoolConnection } from 'mysql2/promise';
import { storePool } from '../db/mysql.js';
import { AuditService } from './auditService.js';
import { StaffService, type StaffRecord } from './staffService.js';
import type { StaffKind } from '../utils/staffAccounts.js';
import {
  MODULES,
  emptyPermissions,
  fullPermissions,
  grantsBeyond,
  hasAnyAccess,
  normalizePermissions,
  permissionsFromRows,
  type Permissions,
} from '../utils/permissions.js';
import {
  WHOLE_COMPANY,
  coversNodes,
  noScope,
  parseScopeNodes,
  resolveScope,
  scopeWithin,
  type Scope,
  type ScopeNode,
  type StoreTree,
} from '../utils/scope.js';

export type StaffAccess = {
  roleId: number | null;
  roleName: string | null;
  isSuperAdmin: boolean;
  permissions: Permissions;
  /** Stores whose orders, pincodes and customers this person sees. */
  scope: Scope;
};

export type NamedScopeNode = ScopeNode & { name: string };

export type AccessActor = {
  /** portal_staff.ID (1 for the local dev seed). */
  staffId: number;
  name: string;
  access: StaffAccess;
};

export type PortalRole = {
  id: number;
  name: string;
  description: string;
  staffCount: number;
  permissions: Permissions;
  /** The signed-in staff member may edit, delete or assign this role. */
  manageable: boolean;
};

export type StaffMember = {
  id: number;
  name: string;
  email: string;
  kind: StaffKind;
  active: boolean;
  /** Linked only: whether the Homecare login itself is active. */
  homecareActive: boolean | null;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  isSuperAdmin: boolean;
  roleId: number | null;
  roleName: string | null;
  scope: { all: boolean; nodes: NamedScopeNode[] };
  /** The signed-in staff member may change this person's role and scope. */
  changeable: boolean;
};

type ScopeRows = { all: boolean; nodes: ScopeNode[] };

function refusal(statusCode: number, message: string) {
  return Object.assign(new Error(message), { statusCode });
}

function accessUnavailable(err: unknown) {
  console.error('[AccessService] portal access tables unreadable', err);
  return refusal(
    503,
    'Portal access settings are unavailable. Run server/sql/portal_access.sql and portal_scope.sql on the store database.'
  );
}

export async function loadStoreTree(): Promise<StoreTree> {
  const [groups] = await storePool.query<any[]>(`SELECT ID as id, ParentID as parentId FROM store_groups`);
  const [stores] = await storePool.query<any[]>(
    `SELECT s.ID as id, g.GroupID as groupId FROM stores s LEFT JOIN store_group_stores g ON g.StoreID = s.ID`
  );
  return {
    groups: groups.map((g) => ({ id: Number(g.id), parentId: g.parentId == null ? null : Number(g.parentId) })),
    stores: stores.map((s) => ({ id: Number(s.id), groupId: s.groupId == null ? null : Number(s.groupId) })),
  };
}

/** Scope rows per staff member with a role. */
async function scopeRows(staffIds?: number[]): Promise<Map<number, ScopeRows>> {
  const result = new Map<number, ScopeRows>();
  if (staffIds && !staffIds.length) return result;
  const filter = staffIds ? 'WHERE r.StaffID IN (?)' : '';
  const [roles] = await storePool.query<any[]>(
    `SELECT r.StaffID as staffId, r.ScopeAll as scopeAll FROM portal_staff_roles r ${filter}`,
    staffIds ? [staffIds] : []
  );
  for (const r of roles) result.set(Number(r.staffId), { all: Number(r.scopeAll) === 1, nodes: [] });
  const [nodes] = await storePool.query<any[]>(
    `SELECT StaffID as staffId, NodeType as type, NodeID as id FROM portal_staff_scope ${staffIds ? 'WHERE StaffID IN (?)' : ''}
     ORDER BY ID ASC`,
    staffIds ? [staffIds] : []
  );
  for (const n of nodes) result.get(Number(n.staffId))?.nodes.push({ type: n.type, id: Number(n.id) });
  return result;
}

async function nodeNames(): Promise<Map<string, string>> {
  const [groups] = await storePool.query<any[]>(`SELECT ID as id, Name as name FROM store_groups`);
  const [stores] = await storePool.query<any[]>(`SELECT ID as id, StoreName as name FROM stores`);
  return new Map([
    ...groups.map((g): [string, string] => [`group:${g.id}`, String(g.name)]),
    ...stores.map((s): [string, string] => [`store:${s.id}`, String(s.name)]),
  ]);
}

function describeScope(rows: ScopeRows, names: Map<string, string>): string {
  if (rows.all) return 'whole company';
  if (!rows.nodes.length) return 'no places';
  return rows.nodes.map((n) => names.get(`${n.type}:${n.id}`) ?? `${n.type} ${n.id}`).join(', ');
}

function cleanRoleInput(body: any): { name: string; description: string; permissions: Permissions } {
  const name = String(body?.name ?? '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 80) throw refusal(400, 'Role name must be 2 to 80 characters.');
  const description = String(body?.description ?? '').trim();
  if (description.length > 255) throw refusal(400, 'Description must be 255 characters or fewer.');
  const permissions = normalizePermissions(body?.permissions);
  if (!hasAnyAccess(permissions)) throw refusal(400, 'Give the role at least one module.');
  return { name, description, permissions };
}

function assertWithin(actor: AccessActor, requested: Permissions) {
  if (actor.access.isSuperAdmin) return;
  const beyond = grantsBeyond(requested, actor.access.permissions);
  if (beyond.length) {
    const shown = beyond.length > 4 ? `${beyond.slice(0, 3).join(', ')} and ${beyond.length - 3} more` : beyond.join(', ');
    throw refusal(403, `You can't grant access you don't have: ${shown}.`);
  }
}

function canManageRole(actor: AccessActor, roleId: number, permissions: Permissions): boolean {
  if (actor.access.isSuperAdmin) return true;
  if (actor.access.roleId === roleId) return false;
  return grantsBeyond(permissions, actor.access.permissions).length === 0;
}

function actorLabel(actor: AccessActor): string {
  return `${actor.name} (${actor.access.roleName ?? 'no role'})`;
}

async function audit(actor: AccessActor, action: string, details: string) {
  try {
    await AuditService.create({ action, entity: 'access', details, user: actorLabel(actor) });
  } catch (err) {
    console.warn('[AccessService] audit write failed', err);
  }
}

async function rolePermissions(roleIds: number[]): Promise<Map<number, Permissions>> {
  const byRole = new Map<number, Permissions>();
  if (!roleIds.length) return byRole;
  const [rows] = await storePool.query<any[]>(
    `SELECT RoleID as roleId, Module as module, CanView as canView, CanEdit as canEdit, CanDelete as canDelete
     FROM portal_role_permissions WHERE RoleID IN (?)`,
    [roleIds]
  );
  const grouped = new Map<number, any[]>();
  for (const row of rows) {
    const id = Number(row.roleId);
    grouped.set(id, [...(grouped.get(id) ?? []), row]);
  }
  for (const id of roleIds) byRole.set(id, permissionsFromRows(grouped.get(id) ?? []));
  return byRole;
}

async function findRole(roleId: number): Promise<{ id: number; name: string; permissions: Permissions } | null> {
  if (!Number.isInteger(roleId) || roleId <= 0) return null;
  const [rows] = await storePool.query<any[]>(`SELECT ID as id, Name as name FROM portal_roles WHERE ID = ?`, [roleId]);
  if (!rows.length) return null;
  const permissions = (await rolePermissions([roleId])).get(roleId) ?? emptyPermissions();
  return { id: Number(rows[0].id), name: String(rows[0].name), permissions };
}

async function writePermissions(conn: PoolConnection, roleId: number, permissions: Permissions) {
  await conn.query(`DELETE FROM portal_role_permissions WHERE RoleID = ?`, [roleId]);
  const rows = MODULES.filter((m) => permissions[m.key].view).map((m) => [
    roleId,
    m.key,
    1,
    permissions[m.key].edit ? 1 : 0,
    permissions[m.key].delete ? 1 : 0,
  ]);
  if (rows.length) {
    await conn.query(
      `INSERT INTO portal_role_permissions (RoleID, Module, CanView, CanEdit, CanDelete) VALUES ?`,
      [rows]
    );
  }
}

function isDuplicateName(err: any) {
  return err?.code === 'ER_DUP_ENTRY';
}

export class AccessService {
  static modules() {
    return MODULES.map((m) => ({ key: m.key, label: m.label, levels: [...m.levels] }));
  }

  /** What a signed-in staff member may do. Super admin never touches the tables. */
  static async forStaff(staffId: number, isSuperAdmin: boolean): Promise<StaffAccess> {
    if (isSuperAdmin) {
      return {
        roleId: null,
        roleName: 'Super admin',
        isSuperAdmin: true,
        permissions: fullPermissions(),
        scope: WHOLE_COMPANY,
      };
    }
    try {
      const [rows] = await storePool.query<any[]>(
        `SELECT r.ID as roleId, r.Name as roleName
         FROM portal_staff_roles s JOIN portal_roles r ON r.ID = s.RoleID
         WHERE s.StaffID = ? LIMIT 1`,
        [staffId]
      );
      if (!rows.length) {
        return { roleId: null, roleName: null, isSuperAdmin: false, permissions: emptyPermissions(), scope: noScope() };
      }
      const roleId = Number(rows[0].roleId);
      const permissions = (await rolePermissions([roleId])).get(roleId) ?? emptyPermissions();
      const held = (await scopeRows([staffId])).get(staffId) ?? { all: false, nodes: [] };
      const scope = held.all ? WHOLE_COMPANY : resolveScope(false, held.nodes, await loadStoreTree());
      return { roleId, roleName: String(rows[0].roleName), isSuperAdmin: false, permissions, scope };
    } catch (err) {
      throw accessUnavailable(err);
    }
  }

  static async listRoles(actor: AccessActor): Promise<PortalRole[]> {
    const [rows] = await storePool.query<any[]>(
      `SELECT r.ID as id, r.Name as name, r.Description as description, COUNT(s.StaffID) as staffCount
       FROM portal_roles r LEFT JOIN portal_staff_roles s ON s.RoleID = r.ID
       GROUP BY r.ID, r.Name, r.Description
       ORDER BY r.Name ASC`
    );
    const ids = rows.map((r) => Number(r.id));
    const permissions = await rolePermissions(ids);
    return rows.map((r) => {
      const id = Number(r.id);
      const granted = permissions.get(id) ?? emptyPermissions();
      return {
        id,
        name: String(r.name),
        description: r.description ? String(r.description) : '',
        staffCount: Number(r.staffCount) || 0,
        permissions: granted,
        manageable: canManageRole(actor, id, granted),
      };
    });
  }

  static async createRole(actor: AccessActor, body: unknown): Promise<PortalRole> {
    const input = cleanRoleInput(body);
    assertWithin(actor, input.permissions);
    const conn = await storePool.getConnection();
    let roleId = 0;
    try {
      await conn.beginTransaction();
      const [res] = await conn.query<any>(
        `INSERT INTO portal_roles (Name, Description, CreatedBy) VALUES (?, ?, ?)`,
        [input.name, input.description || null, actor.staffId]
      );
      roleId = Number(res.insertId);
      await writePermissions(conn, roleId, input.permissions);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      if (isDuplicateName(err)) throw refusal(409, `A role named "${input.name}" already exists.`);
      throw err;
    } finally {
      conn.release();
    }
    await audit(actor, 'Created Role', `Created role "${input.name}"`);
    return (await AccessService.listRoles(actor)).find((r) => r.id === roleId)!;
  }

  static async updateRole(actor: AccessActor, roleId: number, body: unknown): Promise<PortalRole> {
    const existing = await findRole(roleId);
    if (!existing) throw refusal(404, 'That role no longer exists.');
    if (!actor.access.isSuperAdmin && actor.access.roleId === existing.id) {
      throw refusal(403, "You can't change the role you hold.");
    }
    if (!canManageRole(actor, existing.id, existing.permissions)) {
      throw refusal(403, `"${existing.name}" has access you don't have, so you can't change it.`);
    }
    const input = cleanRoleInput(body);
    assertWithin(actor, input.permissions);

    const conn = await storePool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `UPDATE portal_roles SET Name = ?, Description = ?, UpdatedBy = ? WHERE ID = ?`,
        [input.name, input.description || null, actor.staffId, existing.id]
      );
      await writePermissions(conn, existing.id, input.permissions);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      if (isDuplicateName(err)) throw refusal(409, `A role named "${input.name}" already exists.`);
      throw err;
    } finally {
      conn.release();
    }
    const renamed = existing.name === input.name ? '' : ` (renamed from "${existing.name}")`;
    await audit(actor, 'Updated Role', `Updated role "${input.name}"${renamed}`);
    return (await AccessService.listRoles(actor)).find((r) => r.id === existing.id)!;
  }

  static async deleteRole(actor: AccessActor, roleId: number): Promise<{ success: true }> {
    const existing = await findRole(roleId);
    if (!existing) throw refusal(404, 'That role no longer exists.');
    if (!actor.access.isSuperAdmin && actor.access.roleId === existing.id) {
      throw refusal(403, "You can't delete the role you hold.");
    }
    if (!canManageRole(actor, existing.id, existing.permissions)) {
      throw refusal(403, `"${existing.name}" has access you don't have, so you can't delete it.`);
    }
    const [held] = await storePool.query<any[]>(
      `SELECT COUNT(*) as n FROM portal_staff_roles WHERE RoleID = ?`,
      [existing.id]
    );
    const holders = Number(held[0]?.n) || 0;
    if (holders > 0) {
      throw refusal(409, `${holders} staff still hold "${existing.name}". Move them to another role first.`);
    }
    try {
      await storePool.query(`DELETE FROM portal_roles WHERE ID = ?`, [existing.id]);
    } catch (err: any) {
      if (err?.code === 'ER_ROW_IS_REFERENCED_2') {
        throw refusal(409, `Someone was just given "${existing.name}". Move them to another role first.`);
      }
      throw err;
    }
    await audit(actor, 'Deleted Role', `Deleted role "${existing.name}"`);
    return { success: true };
  }

  /** The store's staff list with roles and places. Homecare logins appear only once linked. */
  static async listStaff(actor: AccessActor): Promise<StaffMember[]> {
    const people = await StaffService.list();
    const [assigned] = await storePool.query<any[]>(
      `SELECT s.StaffID as staffId, r.ID as roleId, r.Name as roleName
       FROM portal_staff_roles s JOIN portal_roles r ON r.ID = s.RoleID`
    );
    const roleByStaff = new Map(assigned.map((a) => [Number(a.staffId), a]));
    const permissions = await rolePermissions([...new Set(assigned.map((a) => Number(a.roleId)))]);
    const scopes = await scopeRows();
    const tree = await loadStoreTree();
    const names = await nodeNames();

    return people.map((person) => {
      const held = person.isSuperAdmin ? undefined : roleByStaff.get(person.id);
      const roleId = held ? Number(held.roleId) : null;
      const heldPermissions = roleId ? permissions.get(roleId) ?? emptyPermissions() : emptyPermissions();
      const heldScope = person.isSuperAdmin ? { all: true, nodes: [] } : scopes.get(person.id) ?? { all: false, nodes: [] };
      const changeable =
        person.id !== actor.staffId &&
        (actor.access.isSuperAdmin ||
          (!person.isSuperAdmin &&
            grantsBeyond(heldPermissions, actor.access.permissions).length === 0 &&
            scopeWithin(resolveScope(heldScope.all, heldScope.nodes, tree), actor.access.scope)));
      return {
        id: person.id,
        name: person.name,
        email: person.email,
        kind: person.kind,
        active: person.active,
        homecareActive: person.homecareActive,
        mustChangePassword: person.mustChangePassword,
        lastLoginAt: person.lastLoginAt,
        isSuperAdmin: person.isSuperAdmin,
        roleId,
        roleName: held ? String(held.roleName) : null,
        scope: {
          all: heldScope.all,
          nodes: heldScope.nodes.map((n) => ({ ...n, name: names.get(`${n.type}:${n.id}`) ?? `${n.type} ${n.id}` })),
        },
        changeable,
      };
    });
  }

  private static async member(actor: AccessActor, staffId: number): Promise<StaffMember> {
    const found = (await AccessService.listStaff(actor)).find((s) => s.id === staffId);
    if (!found) throw refusal(404, 'No one on the staff list with that id.');
    return found;
  }

  /**
   * Refuses changing yourself, a super admin (unless you are one), or someone whose role or places
   * go beyond yours.
   */
  private static async changeableTarget(actor: AccessActor, staffId: number, what: string): Promise<StaffRecord> {
    if (!Number.isInteger(staffId) || staffId <= 0) throw refusal(404, 'No one on the staff list with that id.');
    if (staffId === actor.staffId) throw refusal(403, `You can't change your own ${what}.`);
    const target = await StaffService.find(staffId);
    if (!target) throw refusal(404, 'No one on the staff list with that id.');
    if (target.isSuperAdmin && !actor.access.isSuperAdmin) {
      throw refusal(403, `${target.name} is a super admin; only a super admin can change their ${what}.`);
    }
    if (!actor.access.isSuperAdmin) {
      const current = await AccessService.forStaff(staffId, target.isSuperAdmin);
      if (grantsBeyond(current.permissions, actor.access.permissions).length) {
        throw refusal(403, `${target.name} has access you don't have, so you can't change their ${what}.`);
      }
      if (!scopeWithin(current.scope, actor.access.scope)) {
        throw refusal(403, `${target.name} covers places outside yours, so you can't change their ${what}.`);
      }
    }
    return target;
  }

  /** `{ all: true }` for whole company, or `{ all: false, nodes: [{ type, id }] }`. */
  static async setStaffScope(actor: AccessActor, staffId: number, body: any): Promise<StaffMember> {
    if (typeof body?.all !== 'boolean') throw refusal(400, 'Say whether this person covers the whole company.');
    const nodes = body.all ? [] : parseScopeNodes(body.nodes);
    if (!nodes) throw refusal(400, 'Places must be a list of groups and stores.');
    const target = await AccessService.changeableTarget(actor, staffId, 'places');
    if (target.isSuperAdmin) throw refusal(409, 'Super admin always covers the whole company.');
    const before = (await scopeRows([staffId])).get(staffId);
    if (!before) throw refusal(409, `Give ${target.name} a role first.`);

    if (body.all && !actor.access.scope.all) {
      throw refusal(403, 'Only whole-company staff can give whole-company access.');
    }
    const names = await nodeNames();
    const missing = nodes.find((n) => !names.has(`${n.type}:${n.id}`));
    if (missing) throw refusal(404, `That ${missing.type} no longer exists.`);
    if (!coversNodes(actor.access.scope, nodes)) {
      throw refusal(403, 'You can only give places inside your own.');
    }

    const conn = await storePool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(`UPDATE portal_staff_roles SET ScopeAll = ?, AssignedBy = ? WHERE StaffID = ?`, [
        body.all ? 1 : 0,
        actor.staffId,
        staffId,
      ]);
      await conn.query(`DELETE FROM portal_staff_scope WHERE StaffID = ?`, [staffId]);
      if (nodes.length) {
        await conn.query(`INSERT INTO portal_staff_scope (StaffID, NodeType, NodeID, AssignedBy) VALUES ?`, [
          nodes.map((n) => [staffId, n.type, n.id, actor.staffId]),
        ]);
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    const was = describeScope(before, names);
    const now = describeScope({ all: body.all, nodes }, names);
    if (was !== now) await audit(actor, 'Changed Staff Places', `${target.name} now covers ${now} (was ${was})`);
    return AccessService.member(actor, staffId);
  }

  static async assignStaff(actor: AccessActor, staffId: number, rawRoleId: unknown): Promise<StaffMember> {
    const target = await AccessService.changeableTarget(actor, staffId, 'role');
    if (target.isSuperAdmin) {
      throw refusal(409, "Super admin always has full access; it can't be given a store role.");
    }
    const current = await AccessService.forStaff(staffId, false);

    if (rawRoleId === null) {
      await storePool.query(`DELETE FROM portal_staff_roles WHERE StaffID = ?`, [staffId]);
      if (current.roleName) {
        await audit(actor, 'Removed Staff Role', `${target.name} no longer has "${current.roleName}"`);
      }
    } else {
      const role = await findRole(Number(rawRoleId));
      if (!role) throw refusal(404, 'That role no longer exists.');
      assertWithin(actor, role.permissions);
      await storePool.query(
        `INSERT INTO portal_staff_roles (StaffID, RoleID, AssignedBy) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE RoleID = ?, AssignedBy = ?`,
        [staffId, role.id, actor.staffId, role.id, actor.staffId]
      );
      if (current.roleId !== role.id) {
        const from = current.roleName ? ` (was "${current.roleName}")` : '';
        await audit(actor, 'Assigned Staff Role', `${target.name} now has "${role.name}"${from}`);
      }
    }
    return AccessService.member(actor, staffId);
  }

  /** New store login; the temporary password is returned once and never stored in plain text. */
  static async addStoreLogin(
    actor: AccessActor,
    body: any
  ): Promise<{ staff: StaffMember; temporaryPassword: string }> {
    const created = await StaffService.createStoreLogin(actor.staffId, body ?? {});
    const staff = await AccessService.member(actor, created.id);
    await audit(actor, 'Added Staff', `Added store login ${staff.name} <${staff.email}>`);
    return { staff, temporaryPassword: created.temporaryPassword };
  }

  static async homecareMatch(email: unknown): Promise<{ name: string; email: string }> {
    const match = await StaffService.homecareMatch(email);
    return { name: match.name, email: match.email };
  }

  static async linkHomecare(actor: AccessActor, body: any): Promise<StaffMember> {
    const id = await StaffService.linkHomecare(actor.staffId, body?.email);
    const staff = await AccessService.member(actor, id);
    await audit(actor, 'Linked Homecare Login', `Linked ${staff.name} <${staff.email}> to the store portal`);
    return staff;
  }

  /** `{ name }` (store logins) and/or `{ active }`. The route checks Delete for `active`. */
  static async updateStaff(actor: AccessActor, staffId: number, body: any): Promise<StaffMember> {
    const hasName = body?.name !== undefined;
    const hasActive = body?.active !== undefined;
    if (!hasName && !hasActive) throw refusal(400, 'Nothing to change.');
    if (hasActive && typeof body.active !== 'boolean') throw refusal(400, 'Say whether the login is active.');
    const target = await AccessService.changeableTarget(actor, staffId, hasActive ? 'access' : 'name');

    if (hasName && target.kind === 'store') {
      const before = target.name;
      await StaffService.rename(actor.staffId, staffId, body.name);
      const after = (await StaffService.find(staffId))?.name ?? before;
      if (after !== before) await audit(actor, 'Renamed Staff', `${before} is now ${after}`);
    } else if (hasName) {
      throw refusal(409, `${target.name} takes their name from Homecare; change it there.`);
    }
    if (hasActive && body.active !== target.active) {
      await StaffService.setActive(actor.staffId, staffId, body.active);
      await audit(
        actor,
        body.active ? 'Reactivated Staff' : 'Deactivated Staff',
        `${target.name} <${target.email}> ${body.active ? 'can use the store portal again' : 'can no longer use the store portal'}`
      );
    }
    return AccessService.member(actor, staffId);
  }

  static async resetStaffPassword(actor: AccessActor, staffId: number): Promise<{ temporaryPassword: string }> {
    const target = await AccessService.changeableTarget(actor, staffId, 'password');
    if (target.kind === 'linked') throw refusal(409, `${target.name}'s password is managed in Homecare.`);
    const temporaryPassword = await StaffService.resetPassword(actor.staffId, staffId);
    await audit(actor, 'Reset Staff Password', `Gave ${target.name} a new temporary password`);
    return { temporaryPassword };
  }
}
