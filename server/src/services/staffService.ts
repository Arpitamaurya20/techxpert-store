import bcrypt from 'bcryptjs';
import { storePool, userPool } from '../db/mysql.js';
import { isDevAdminAllowed } from '../config/security.js';
import {
  cleanStaffName,
  issuedBeforePasswordChange,
  normalizeEmail,
  passwordProblem,
  temporaryPassword,
  type StaffKind,
} from '../utils/staffAccounts.js';

/** Who a portal session belongs to, checked live on every request. */
export type StaffIdentity = {
  id: number;
  name: string;
  email: string;
  kind: StaffKind;
  isSuperAdmin: boolean;
  mustChangePassword: boolean;
};

export type StaffRecord = StaffIdentity & {
  active: boolean;
  /** Linked only: whether the Homecare login itself is active. Null for store logins. */
  homecareActive: boolean | null;
  lastLoginAt: string | null;
};

type StaffRow = {
  id: number;
  homecareAdminId: number | null;
  name: string | null;
  email: string | null;
  passwordHash: string | null;
  isSuperAdmin: boolean;
  isActive: boolean;
  mustChangePassword: boolean;
  passwordChangedAt: Date | null;
  lastLoginAt: Date | null;
};

type HomecareLogin = { id: number; name: string; email: string; active: boolean; passwordHash: string };

const BCRYPT_COST = 12;

/** Local seed (ALLOW_DEV_ADMIN=1): a super admin that exists only in memory. Store ids start at 1001. */
const DEV_SEED_ID = 1;
const DEV_SEED_EMAILS = ['admin@techxpert.in', 'admin@techxpertstore.com'];
const DEV_SEED_PASSWORDS = ['admin123', 'root123'];
const devSeed: StaffIdentity = {
  id: DEV_SEED_ID,
  name: 'Super Admin',
  email: 'admin@techxpert.in',
  kind: 'store',
  isSuperAdmin: true,
  mustChangePassword: false,
};

/** Compared against when no login matches, so a wrong email costs the same time as a wrong password. */
const UNUSED_HASH = bcrypt.hashSync('unused-password-for-timing', 10);

function refusal(statusCode: number, message: string) {
  return Object.assign(new Error(message), { statusCode });
}

const WRONG_LOGIN = 'Invalid email or password';
const SWITCHED_OFF = 'Your store portal access is switched off. Ask a store admin.';

function staffTablesMissing(err: unknown) {
  console.error('[StaffService] portal_staff unreadable', err);
  return refusal(503, 'Staff accounts are unavailable. Run server/sql/portal_staff.sql on the store database.');
}

const STAFF_COLUMNS = `ID as id, HomecareAdminID as homecareAdminId, Name as name, Email as email,
  PasswordHash as passwordHash, IsSuperAdmin as isSuperAdmin, IsActive as isActive,
  MustChangePassword as mustChangePassword, UNIX_TIMESTAMP(PasswordChangedAt) as passwordChangedAt,
  LastLoginAt as lastLoginAt`;

/**
 * PasswordChangedAt is written and read as Unix seconds from the API's clock, the same clock that sets
 * token `iat`. With the database's NOW() a clock skew could refuse the token issued right after a change.
 */
const nowSeconds = () => Math.floor(Date.now() / 1000);

function toRow(r: any): StaffRow {
  return {
    id: Number(r.id),
    homecareAdminId: r.homecareAdminId == null ? null : Number(r.homecareAdminId),
    name: r.name ?? null,
    email: r.email ?? null,
    passwordHash: r.passwordHash ?? null,
    isSuperAdmin: Number(r.isSuperAdmin) === 1,
    isActive: Number(r.isActive) === 1,
    mustChangePassword: Number(r.mustChangePassword) === 1,
    passwordChangedAt: r.passwordChangedAt == null ? null : new Date(Number(r.passwordChangedAt) * 1000),
    lastLoginAt: r.lastLoginAt ? new Date(r.lastLoginAt) : null,
  };
}

async function staffWhere(where: string, params: unknown[]): Promise<StaffRow[]> {
  try {
    const [rows] = await storePool.query<any[]>(`SELECT ${STAFF_COLUMNS} FROM portal_staff WHERE ${where}`, params);
    return rows.map(toRow);
  } catch (err: any) {
    if (err?.statusCode) throw err;
    throw staffTablesMissing(err);
  }
}

/** Read-only: Homecare logins by id. */
async function homecareById(ids: number[]): Promise<Map<number, HomecareLogin>> {
  const result = new Map<number, HomecareLogin>();
  if (!ids.length) return result;
  const [rows] = await userPool.query<any[]>(
    `SELECT admin_id as id, name, email, is_active as active, password_hash as passwordHash
     FROM admin_users WHERE admin_id IN (?)`,
    [ids]
  );
  for (const r of rows) {
    result.set(Number(r.id), {
      id: Number(r.id),
      name: String(r.name ?? ''),
      email: String(r.email ?? '').toLowerCase(),
      active: Number(r.active) === 1,
      passwordHash: String(r.passwordHash ?? ''),
    });
  }
  return result;
}

/** Read-only: the Homecare login with this email, if any. */
async function homecareByEmail(email: string): Promise<HomecareLogin | null> {
  const [rows] = await userPool.query<any[]>(
    `SELECT admin_id as id FROM admin_users WHERE LOWER(email) = ? ORDER BY is_active DESC, admin_id ASC LIMIT 1`,
    [email]
  );
  if (!rows.length) return null;
  return (await homecareById([Number(rows[0].id)])).get(Number(rows[0].id)) ?? null;
}

function identity(row: StaffRow, homecare?: HomecareLogin): StaffIdentity {
  return {
    id: row.id,
    name: homecare ? homecare.name : String(row.name ?? ''),
    email: homecare ? homecare.email : String(row.email ?? ''),
    kind: row.homecareAdminId == null ? 'store' : 'linked',
    isSuperAdmin: row.isSuperAdmin,
    mustChangePassword: row.homecareAdminId == null && row.mustChangePassword,
  };
}

async function markSignedIn(id: number) {
  await storePool.query(`UPDATE portal_staff SET LastLoginAt = NOW() WHERE ID = ?`, [id]).catch((err) => {
    console.warn('[StaffService] LastLoginAt not recorded', err);
  });
}

async function hash(password: string) {
  return bcrypt.hash(password, BCRYPT_COST);
}

function isDuplicate(err: any) {
  return err?.code === 'ER_DUP_ENTRY';
}

export class StaffService {
  /**
   * Store login first; otherwise a Homecare login that has been linked. Unlinked Homecare logins are refused.
   * Wrong email and wrong password give the same answer; the reason access is off is only told
   * after the password matched.
   */
  static async authenticate(rawEmail: unknown, rawPassword: unknown): Promise<StaffIdentity> {
    const email = normalizeEmail(rawEmail);
    const password = String(rawPassword ?? '');
    if (!email || !password) throw refusal(400, 'Email and password are required');

    const [store] = await staffWhere('Email = ?', [email]);
    if (store) {
      if (!(await bcrypt.compare(password, store.passwordHash ?? ''))) throw refusal(401, WRONG_LOGIN);
      if (!store.isActive) throw refusal(403, SWITCHED_OFF);
      await markSignedIn(store.id);
      return identity(store);
    }

    if (isDevAdminAllowed() && DEV_SEED_EMAILS.includes(email) && DEV_SEED_PASSWORDS.includes(password)) {
      console.warn('[StaffService] ALLOW_DEV_ADMIN seed sign-in', email);
      return { ...devSeed, email };
    }

    const homecare = await homecareByEmail(email);
    if (!homecare) {
      await bcrypt.compare(password, UNUSED_HASH);
      throw refusal(401, WRONG_LOGIN);
    }
    if (!(await bcrypt.compare(password, homecare.passwordHash).catch(() => false))) {
      throw refusal(401, WRONG_LOGIN);
    }
    const [linked] = await staffWhere('HomecareAdminID = ?', [homecare.id]);
    if (!linked) {
      throw refusal(403, "This Homecare login isn't set up for the store portal. Ask a store admin to link it.");
    }
    if (!homecare.active) throw refusal(403, 'Your Homecare login is switched off, so the store portal is too.');
    if (!linked.isActive) throw refusal(403, SWITCHED_OFF);
    await markSignedIn(linked.id);
    return identity(linked, homecare);
  }

  /** Live check on every request: still on the list, still active, token newer than the last password change. */
  static async assertActive(staffId: number, issuedAt?: unknown): Promise<StaffIdentity> {
    if (staffId === DEV_SEED_ID) {
      if (isDevAdminAllowed()) return devSeed;
      throw refusal(401, 'Administrative login required');
    }
    const [row] = await staffWhere('ID = ?', [staffId]);
    if (!row || !row.isActive) throw refusal(401, SWITCHED_OFF);
    if (issuedBeforePasswordChange(issuedAt, row.passwordChangedAt)) {
      throw refusal(401, 'Your password was changed. Sign in again.');
    }
    if (row.homecareAdminId == null) return identity(row);
    const homecare = (await homecareById([row.homecareAdminId])).get(row.homecareAdminId);
    if (!homecare || !homecare.active) throw refusal(401, 'Your Homecare login is switched off, so the store portal is too.');
    return identity(row, homecare);
  }

  /** Everyone on the store's staff list. Never lists Homecare logins that are not linked. */
  static async list(): Promise<StaffRecord[]> {
    const rows = await staffWhere('1 = 1', []);
    const homecare = await homecareById(rows.flatMap((r) => (r.homecareAdminId == null ? [] : [r.homecareAdminId])));
    return rows
      .map((row): StaffRecord => {
        const login = row.homecareAdminId == null ? undefined : homecare.get(row.homecareAdminId);
        const base = identity(row, login);
        return {
          ...base,
          name: base.name || (row.homecareAdminId != null ? 'Homecare login no longer exists' : ''),
          active: row.isActive,
          homecareActive: row.homecareAdminId == null ? null : Boolean(login?.active),
          lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
        };
      })
      .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  }

  static async find(staffId: number): Promise<StaffRecord | null> {
    if (!Number.isInteger(staffId) || staffId <= 0) return null;
    return (await StaffService.list()).find((s) => s.id === staffId) ?? null;
  }

  /** New store login with a temporary password the person must change at first sign-in. */
  static async createStoreLogin(
    actorId: number | null,
    body: { name?: unknown; email?: unknown },
    options: { superAdmin?: boolean; password?: string } = {}
  ): Promise<{ id: number; temporaryPassword: string }> {
    const name = cleanStaffName(body.name);
    if (!name) throw refusal(400, 'Enter a name of 2 to 120 characters.');
    const email = normalizeEmail(body.email);
    if (!email) throw refusal(400, 'Enter a valid work email.');
    await StaffService.assertEmailFree(email);

    const password = options.password ?? temporaryPassword();
    const problem = options.password ? passwordProblem(password, { email }) : null;
    if (problem) throw refusal(400, problem);
    try {
      const [res] = await storePool.query<any>(
        `INSERT INTO portal_staff (Name, Email, PasswordHash, IsSuperAdmin, MustChangePassword, PasswordChangedAt, CreatedBy)
         VALUES (?, ?, ?, ?, ?, FROM_UNIXTIME(?), ?)`,
        [name, email, await hash(password), options.superAdmin ? 1 : 0, options.password ? 0 : 1, nowSeconds(), actorId]
      );
      return { id: Number(res.insertId), temporaryPassword: password };
    } catch (err) {
      if (isDuplicate(err)) throw refusal(409, `A store login already uses ${email}.`);
      throw err;
    }
  }

  /** The active, not-yet-linked Homecare login with exactly this email. Says nothing about anyone else. */
  static async homecareMatch(rawEmail: unknown): Promise<{ homecareAdminId: number; name: string; email: string }> {
    const email = normalizeEmail(rawEmail);
    if (!email) throw refusal(400, 'Enter the exact Homecare email.');
    const [store] = await staffWhere('Email = ?', [email]);
    if (store) throw refusal(409, `${email} already has a store login, so it can't also be linked.`);
    const homecare = await homecareByEmail(email);
    if (!homecare || !homecare.active) throw refusal(404, 'No active Homecare login with that email.');
    const [linked] = await staffWhere('HomecareAdminID = ?', [homecare.id]);
    if (linked) throw refusal(409, `${homecare.name} is already linked.`);
    return { homecareAdminId: homecare.id, name: homecare.name, email: homecare.email };
  }

  static async linkHomecare(actorId: number | null, rawEmail: unknown, options: { superAdmin?: boolean } = {}): Promise<number> {
    const match = await StaffService.homecareMatch(rawEmail);
    try {
      const [res] = await storePool.query<any>(
        `INSERT INTO portal_staff (HomecareAdminID, IsSuperAdmin, CreatedBy) VALUES (?, ?, ?)`,
        [match.homecareAdminId, options.superAdmin ? 1 : 0, actorId]
      );
      return Number(res.insertId);
    } catch (err) {
      if (isDuplicate(err)) throw refusal(409, `${match.name} is already linked.`);
      throw err;
    }
  }

  static async rename(actorId: number, staffId: number, rawName: unknown): Promise<void> {
    const name = cleanStaffName(rawName);
    if (!name) throw refusal(400, 'Enter a name of 2 to 120 characters.');
    const [res] = await storePool.query<any>(
      `UPDATE portal_staff SET Name = ?, UpdatedBy = ? WHERE ID = ? AND HomecareAdminID IS NULL`,
      [name, actorId, staffId]
    );
    if (!res.affectedRows) throw refusal(409, 'A linked person takes their name from Homecare; change it there.');
  }

  static async setActive(actorId: number, staffId: number, active: boolean): Promise<void> {
    await storePool.query(`UPDATE portal_staff SET IsActive = ?, UpdatedBy = ? WHERE ID = ?`, [
      active ? 1 : 0,
      actorId,
      staffId,
    ]);
  }

  /** New temporary password; every session that person has open ends. Store logins only. */
  static async resetPassword(actorId: number, staffId: number): Promise<string> {
    const password = temporaryPassword();
    const [res] = await storePool.query<any>(
      `UPDATE portal_staff SET PasswordHash = ?, MustChangePassword = 1, PasswordChangedAt = FROM_UNIXTIME(?), UpdatedBy = ?
       WHERE ID = ? AND HomecareAdminID IS NULL`,
      [await hash(password), nowSeconds(), actorId, staffId]
    );
    if (!res.affectedRows) throw refusal(409, "A linked person's password is managed in Homecare.");
    return password;
  }

  /** The signed-in person's own password. Store logins only. */
  static async changeOwnPassword(staffId: number, rawCurrent: unknown, rawNext: unknown): Promise<void> {
    if (staffId === DEV_SEED_ID) throw refusal(409, 'The local seed login has no password to change.');
    const current = String(rawCurrent ?? '');
    const next = String(rawNext ?? '');
    const [row] = await staffWhere('ID = ?', [staffId]);
    if (!row || !row.isActive) throw refusal(401, SWITCHED_OFF);
    if (row.homecareAdminId != null) throw refusal(409, 'Your password is managed in Homecare; change it there.');
    if (!(await bcrypt.compare(current, row.passwordHash ?? ''))) throw refusal(400, 'Your current password is wrong.');
    const problem = passwordProblem(next, { email: row.email ?? undefined, current });
    if (problem) throw refusal(400, problem);
    await storePool.query(
      `UPDATE portal_staff SET PasswordHash = ?, MustChangePassword = 0, PasswordChangedAt = FROM_UNIXTIME(?), UpdatedBy = ?
       WHERE ID = ?`,
      [await hash(next), nowSeconds(), staffId, staffId]
    );
  }

  /** Bootstrap: make an existing staff row a super admin. */
  static async promoteToSuperAdmin(staffId: number): Promise<void> {
    await storePool.query(`UPDATE portal_staff SET IsSuperAdmin = 1, IsActive = 1 WHERE ID = ?`, [staffId]);
  }

  /** A store login's email must not belong to a linked Homecare login, or be one that should be linked instead. */
  private static async assertEmailFree(email: string): Promise<void> {
    const [store] = await staffWhere('Email = ?', [email]);
    if (store) throw refusal(409, `A store login already uses ${email}.`);
    const homecare = await homecareByEmail(email);
    if (!homecare) return;
    const [linked] = await staffWhere('HomecareAdminID = ?', [homecare.id]);
    if (linked) throw refusal(409, `${email} belongs to ${homecare.name}, who is already linked.`);
    throw refusal(
      409,
      `${email} is a Homecare login. Link it instead, so ${homecare.name} keeps one password for both.`
    );
  }
}
