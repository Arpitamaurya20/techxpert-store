import { isFileStoreAllowed } from '../config/security.js';

/** True when MySQL itself is unreachable — not a bad row or missing table. */
export function isMysqlConnectivityError(err: unknown): boolean {
  const code = (err as { code?: string } | undefined)?.code;
  return (
    code === 'ECONNREFUSED' ||
    code === 'PROTOCOL_CONNECTION_LOST' ||
    code === 'ENOTFOUND' ||
    code === 'ETIMEDOUT' ||
    code === 'ER_ACCESS_DENIED_ERROR' ||
    code === 'ER_BAD_DB_ERROR' ||
    code === 'ER_DBACCESS_DENIED_ERROR'
  );
}

/** Throw 503 when MySQL store/users is down and file-store demo mode is off. */
export function throwMysqlUnavailable(context: string, err?: unknown): never {
  console.error(`[DB] ${context}`, err);
  throw Object.assign(
    new Error(
      `Database unavailable (${context}). Check MySQL dual-DB (homecare + techxpertstore). Set ALLOW_FILE_STORE=1 only for local demo without MySQL.`
    ),
    { statusCode: 503 }
  );
}

/**
 * After a MySQL failure: use fileFn when ALLOW_FILE_STORE=1, otherwise 503.
 * Never call this on a successful empty MySQL result — return [] instead.
 * Schema / value errors are rethrown with a clear message so the portal is not
 * told the whole database is down.
 */
export async function mysqlOrFileStore<T>(
  context: string,
  err: unknown,
  fileFn: () => T | Promise<T>
): Promise<T> {
  if (isFileStoreAllowed()) {
    console.warn(`[DB] ${context} — ALLOW_FILE_STORE=1, using database.json`, err);
    return fileFn();
  }
  const code = (err as { code?: string } | undefined)?.code;
  const sqlMessage = String((err as { sqlMessage?: string } | undefined)?.sqlMessage || '').trim();
  if (!isMysqlConnectivityError(err)) {
    console.error(`[DB] ${context}`, err);
    if (code === 'ER_NO_SUCH_TABLE') {
      throw Object.assign(
        new Error(`Missing table for ${context}. Run the matching script under server/sql/ on techxpertstore.`),
        { statusCode: 503 }
      );
    }
    if (code === 'ER_BAD_FIELD_ERROR') {
      throw Object.assign(
        new Error(`Table columns out of date for ${context}. Run the matching script under server/sql/ on techxpertstore.`),
        { statusCode: 503 }
      );
    }
    throw Object.assign(new Error(sqlMessage || `Could not complete ${context}.`), { statusCode: 500 });
  }
  throwMysqlUnavailable(context, err);
}
