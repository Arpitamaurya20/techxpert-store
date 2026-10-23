import { isFileStoreAllowed } from '../config/security.js';

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
  throwMysqlUnavailable(context, err);
}
