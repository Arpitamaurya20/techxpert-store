import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const MYSQL_HOST = process.env.MYSQL_HOST || 'localhost';
const MYSQL_PORT = Number(process.env.MYSQL_PORT) || 3306;
const MYSQL_USER = process.env.MYSQL_USER || 'root';
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || 'root123';

const DB_STORE = process.env.DB_STORE || process.env.DB_CATALOG || 'techxpertstore';
const DB_USERS = process.env.DB_USERS || 'homecare';

export const storePool = mysql.createPool({
  host: MYSQL_HOST,
  port: MYSQL_PORT,
  user: MYSQL_USER,
  password: MYSQL_PASSWORD,
  database: DB_STORE,
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
});

// User & Identity pool connects to homecare
export const userPool = mysql.createPool({
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

export async function testDbConnections(): Promise<{
  store: boolean;
  users: boolean;
}> {
  const result = { store: false, users: false };

  try {
    const conn1 = await storePool.getConnection();
    await conn1.ping();
    conn1.release();
    result.store = true;
  } catch (e) {
    console.warn('[DB] Could not connect to store pool (techxpertstore)', e);
  }

  try {
    const conn2 = await userPool.getConnection();
    await conn2.ping();
    conn2.release();
    result.users = true;
  } catch (e) {
    console.warn('[DB] Could not connect to users pool (homecare)', e);
  }

  return result;
}

