import type { PoolConnection } from 'mysql2/promise';
import { storePool, userPool } from '../db/mysql.js';
import { AuditService } from './auditService.js';
import {
  MODULES,
  SUPER_ADMIN_ROLE,
  emptyPermissions,
  fullPermissions,
  grantsBeyond,
  hasAnyAccess,
  normalizePermissions,
  permissionsFromRows,
  type Permissions,
} from '../utils/permissions.js';

export type StaffAccess = {
  roleId: number | null;
  roleName: string | null;
  isSuperAdmin: boolean;
  permissions: Permissions;
};

export type AccessActor = {
  adminId: number;
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
  homecareRole: string;
  active: boolean;
  isSuperAdmin: boolean;
  roleId: number | null;
  roleName: string | null;
  /** The signed-in staff member may change this person's role. */
  changeable: boolean;
};

function refusal(statusCode: number, message: string) {
  return Object.assign(new Error(message), { statusCode });
}

function accessUnavailable(err: unknown) {
  console.error('[AccessService] portal access tables unreadable', err);
  return refusal(503, 'Portal access settings are unavailable. Run server/sql/portal_access.sql on the store database.');
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

  /** What a signed-in admin may do. Super admin never touches the tables. */
  static async forAdmin(adminId: number, homecareRole: string): Promise<StaffAccess> {
    if (homecareRole === SUPER_ADMIN_ROLE) {
      return { roleId: null, roleName: 'Super admin', isSuperAdmin: true, permissions: fullPermissions() };
    }
    try {
      const [rows] = await storePool.query<any[]>(
        `SELECT r.ID as roleId, r.Name as roleName
         FROM portal_staff_roles s JOIN portal_roles r ON r.ID = s.RoleID
         WHERE s.AdminID = ? LIMIT 1`,
        [adminId]
      );
      if (!rows.length) {
        return { roleId: null, roleName: null, isSuperAdmin: false, permissions: emptyPermissions() };
      }
      const roleId = Number(rows[0].roleId);
      const permissions = (await rolePermissions([roleId])).get(roleId) ?? emptyPermissions();
      return { roleId, roleName: String(rows[0].roleName), isSuperAdmin: false, permissions };
    } catch (err) {
      throw accessUnavailable(err);
    }
  }

  static async listRoles(actor: AccessActor): Promise<PortalRole[]> {
    const [rows] = await storePool.query<any[]>(
      `SELECT r.ID as id, r.Name as name, r.Description as description, COUNT(s.AdminID) as staffCount
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
        [input.name, input.description || null, actor.adminId]
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
        [input.name, input.description || null, actor.adminId, existing.id]
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

  static async listStaff(actor: AccessActor): Promise<StaffMember[]> {
    const [admins] = await userPool.query<any[]>(
      `SELECT admin_id as id, name, email, role, is_active as active FROM admin_users ORDER BY is_active DESC, name ASC`
    );
    const [assigned] = await storePool.query<any[]>(
      `SELECT s.AdminID as adminId, r.ID as roleId, r.Name as roleName
       FROM portal_staff_roles s JOIN portal_roles r ON r.ID = s.RoleID`
    );
    const roleByAdmin = new Map(assigned.map((a) => [Number(a.adminId), a]));
    const permissions = await rolePermissions([...new Set(assigned.map((a) => Number(a.roleId)))]);

    return admins.map((a) => {
      const id = Number(a.id);
      const isSuperAdmin = a.role === SUPER_ADMIN_ROLE;
      const held = isSuperAdmin ? undefined : roleByAdmin.get(id);
      const roleId = held ? Number(held.roleId) : null;
      const heldPermissions = roleId ? permissions.get(roleId) ?? emptyPermissions() : emptyPermissions();
      const changeable =
        !isSuperAdmin &&
        id !== actor.adminId &&
        (actor.access.isSuperAdmin || grantsBeyond(heldPermissions, actor.access.permissions).length === 0);
      return {
        id,
        name: String(a.name ?? ''),
        email: String(a.email ?? ''),
        homecareRole: String(a.role ?? ''),
        active: Number(a.active) === 1,
        isSuperAdmin,
        roleId,
        roleName: held ? String(held.roleName) : null,
        changeable,
      };
    });
  }

  static async assignStaff(actor: AccessActor, adminId: number, rawRoleId: unknown): Promise<StaffMember> {
    if (!Number.isInteger(adminId) || adminId <= 0) throw refusal(404, 'No staff login with that id.');
    if (adminId === actor.adminId) throw refusal(403, "You can't change your own role.");

    const [admins] = await userPool.query<any[]>(
      `SELECT admin_id as id, name, role FROM admin_users WHERE admin_id = ?`,
      [adminId]
    );
    const target = admins[0];
    if (!target) throw refusal(404, 'No staff login with that id.');
    if (target.role === SUPER_ADMIN_ROLE) {
      throw refusal(409, "Super admin always has full access; it can't be given a store role.");
    }

    const current = await AccessService.forAdmin(adminId, String(target.role));
    if (!actor.access.isSuperAdmin && grantsBeyond(current.permissions, actor.access.permissions).length) {
      throw refusal(403, `${target.name} has access you don't have, so you can't change their role.`);
    }

    if (rawRoleId === null) {
      await storePool.query(`DELETE FROM portal_staff_roles WHERE AdminID = ?`, [adminId]);
      if (current.roleName) {
        await audit(actor, 'Removed Staff Role', `${target.name} no longer has "${current.roleName}"`);
      }
    } else {
      const role = await findRole(Number(rawRoleId));
      if (!role) throw refusal(404, 'That role no longer exists.');
      assertWithin(actor, role.permissions);
      await storePool.query(
        `INSERT INTO portal_staff_roles (AdminID, RoleID, AssignedBy) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE RoleID = ?, AssignedBy = ?`,
        [adminId, role.id, actor.adminId, role.id, actor.adminId]
      );
      if (current.roleId !== role.id) {
        const from = current.roleName ? ` (was "${current.roleName}")` : '';
        await audit(actor, 'Assigned Staff Role', `${target.name} now has "${role.name}"${from}`);
      }
    }

    const staff = await AccessService.listStaff(actor);
    return staff.find((s) => s.id === adminId)!;
  }
}
