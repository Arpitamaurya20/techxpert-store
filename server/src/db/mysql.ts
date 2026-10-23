import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const MYSQL_HOST = process.env.MYSQL_HOST || 'localhost';
const MYSQL_PORT = Number(process.env.MYSQL_PORT) || 3306;
const MYSQL_USER = process.env.MYSQL_USER || 'root';
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || 'root123';

/** Catalog / commerce schema (products, orders, CMS, …) */
export const DB_STORE = process.env.DB_STORE || process.env.DB_CATALOG || 'techxpertstore';
/** Identity schema (users, admin_users, OTP, addresses) */
export const DB_USERS = process.env.DB_USERS || 'homecare';

export const storePool: Pool = mysql.createPool({
  host: MYSQL_HOST,
  port: MYSQL_PORT,
  user: MYSQL_USER,
  password: MYSQL_PASSWORD,
  database: DB_STORE,
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
});

/** Identity & auth — homecare only */
export const userPool: Pool = mysql.createPool({
  host: MYSQL_HOST,
  port: MYSQL_PORT,
  user: MYSQL_USER,
  password: MYSQL_PASSWORD,
  database: DB_USERS,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Backward-compatibility aliases
export const catalogPool = storePool;
export const commercePool = storePool;

export type DbHealth = {
  ok: boolean;
  database: string;
  host: string;
  error?: string;
};

export type DualDbHealth = {
  users: DbHealth;
  store: DbHealth;
};

/**
 * Query techxpertstore (catalog / commerce). Prefer this over importing storePool directly
 * so identity SQL does not accidentally land here.
 *
 * Same-host cross-DB JOINs to `homecare.*` are allowed when enriching orders with customer names.
 */
export function queryStore<T extends RowDataPacket[][] | RowDataPacket[] | ResultSetHeader>(
  sql: string,
  params?: any[]
) {
  return storePool.query<T>(sql, params);
}

/**
 * Query homecare (identity). Prefer this over importing userPool directly.
 *
 * Same-host cross-DB JOINs to `techxpertstore.*` are allowed when enriching users with order spend.
 */
export function queryUsers<T extends RowDataPacket[][] | RowDataPacket[] | ResultSetHeader>(
  sql: string,
  params?: any[]
) {
  return userPool.query<T>(sql, params);
}

export async function getStoreConnection(): Promise<PoolConnection> {
  return storePool.getConnection();
}

export async function testDbConnections(): Promise<DualDbHealth> {
  const base = { host: `${MYSQL_HOST}:${MYSQL_PORT}` };

  const users: DbHealth = { ok: false, database: DB_USERS, ...base };
  const store: DbHealth = { ok: false, database: DB_STORE, ...base };

  try {
    const conn = await storePool.getConnection();
    try {
      await conn.ping();
      const [rows] = await conn.query<RowDataPacket[]>(`SELECT DATABASE() as db`);
      store.ok = true;
      if (rows[0]?.db) store.database = String(rows[0].db);
    } finally {
      conn.release();
    }
  } catch (e: any) {
    store.error = e?.message || String(e);
    console.warn(`[DB] store pool (${DB_STORE}) unreachable:`, store.error);
  }

  try {
    const conn = await userPool.getConnection();
    try {
      await conn.ping();
      const [rows] = await conn.query<RowDataPacket[]>(`SELECT DATABASE() as db`);
      users.ok = true;
      if (rows[0]?.db) users.database = String(rows[0].db);
    } finally {
      conn.release();
    }
  } catch (e: any) {
    users.error = e?.message || String(e);
    console.warn(`[DB] users pool (${DB_USERS}) unreachable:`, users.error);
  }

  return { users, store };
}

export function logDbBootStatus(health: DualDbHealth) {
  const fmt = (label: string, h: DbHealth) =>
    h.ok
      ? `[DB] ${label}: OK → ${h.database} @ ${h.host}`
      : `[DB] ${label}: DOWN → expected ${h.database} @ ${h.host}${h.error ? ` (${h.error})` : ''}`;

  console.log(fmt('users (login/identity)', health.users));
  console.log(fmt('store (catalog/commerce)', health.store));
  if (!health.users.ok || !health.store.ok) {
    console.warn(
      '[DB] Dual-DB incomplete. Login needs homecare; catalog/orders need techxpertstore. Set MYSQL_* / DB_USERS / DB_STORE in .env'
    );
  }
}
