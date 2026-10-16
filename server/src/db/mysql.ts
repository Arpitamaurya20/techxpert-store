import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const MYSQL_HOST = process.env.MYSQL_HOST || 'localhost';
const MYSQL_PORT = Number(process.env.MYSQL_PORT) || 3306;
const MYSQL_USER = process.env.MYSQL_USER || 'root';
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || 'root123';

const DB_CATALOG = process.env.DB_CATALOG || 'techxpertstore';
const DB_USERS = process.env.DB_USERS || 'techxpert_users';
const DB_COMMERCE = process.env.DB_COMMERCE || 'techxpert_commerce';

export const catalogPool = mysql.createPool({
  host: MYSQL_HOST,
  port: MYSQL_PORT,
  user: MYSQL_USER,
  password: MYSQL_PASSWORD,
  database: DB_CATALOG,
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
});

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

export const commercePool = mysql.createPool({
  host: MYSQL_HOST,
  port: MYSQL_PORT,
  user: MYSQL_USER,
  password: MYSQL_PASSWORD,
  database: DB_COMMERCE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export async function testDbConnections(): Promise<{
  catalog: boolean;
  users: boolean;
  commerce: boolean;
}> {
  const result = { catalog: false, users: false, commerce: false };

  try {
    const conn1 = await catalogPool.getConnection();
    await conn1.ping();
    conn1.release();
    result.catalog = true;
  } catch (e) {
    console.warn('[DB] Could not connect to catalog pool (techxpertstore)', e);
  }

  try {
    const conn2 = await userPool.getConnection();
    await conn2.ping();
    conn2.release();
    result.users = true;
  } catch (e) {
    console.warn('[DB] Could not connect to users pool (techxpert_users)', e);
  }

  try {
    const conn3 = await commercePool.getConnection();
    await conn3.ping();
    conn3.release();
    result.commerce = true;
  } catch (e) {
    console.warn('[DB] Could not connect to commerce pool (techxpert_commerce)', e);
  }

  return result;
}
