import { storePool } from '../db/mysql.js';
import { store } from '../db/store.js';
import { mysqlOrFileStore } from '../db/mysqlErrors.js';
import type { AuditLogEntry } from '../data/seedData.js';

const VALID_ENTITIES = new Set([
  'banner',
  'section',
  'bulk_tier',
  'product',
  'publish',
  'order',
  'category',
  'delivery',
  'access',
  'store',
  'help',
  'about',
  'policy',
  'setting',
]);

function normalizeRow(row: any): AuditLogEntry {
  return {
    id: String(row.id),
    action: row.action,
    entity: row.entity,
    details: row.details || '',
    user: row.actor || row.user || 'Unknown',
    timestamp: row.createdAt || row.timestamp || new Date().toISOString(),
  };
}

export class AuditService {
  static async list(limit = 100): Promise<AuditLogEntry[]> {
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);

    try {
      const [rows] = await storePool.query<any[]>(
        `SELECT id, action, entity, details, actor, created_at as createdAt
         FROM portal_audit_logs
         ORDER BY created_at DESC
         LIMIT ?`,
        [safeLimit]
      );
      return rows.map((r) =>
        normalizeRow({
          ...r,
          createdAt:
            r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
        })
      );
    } catch (err) {
      return mysqlOrFileStore('audit.list', err, () => store.getAuditLogs(safeLimit));
    }
  }

  static async create(input: {
    action: string;
    entity: string;
    details?: string;
    user?: string;
  }): Promise<AuditLogEntry> {
    const action = String(input.action || '').trim();
    const entity = String(input.entity || '').trim();
    const details = String(input.details || '').trim();
    const user = String(input.user || 'Store Admin').trim() || 'Store Admin';

    if (!action) throw Object.assign(new Error('action is required'), { statusCode: 400 });
    if (!VALID_ENTITIES.has(entity)) {
      throw Object.assign(
        new Error(`entity must be one of: ${[...VALID_ENTITIES].join(', ')}`),
        { statusCode: 400 }
      );
    }

    try {
      const [insertRes] = await storePool.query<any>(
        `INSERT INTO portal_audit_logs (action, entity, details, actor)
         VALUES (?, ?, ?, ?)`,
        [action, entity, details || null, user]
      );

      return {
        id: String(insertRes.insertId),
        action,
        entity: entity as AuditLogEntry['entity'],
        details,
        user,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return mysqlOrFileStore('audit.create', err, () =>
        store.createAuditLog({
          id: `log-${Date.now()}`,
          action,
          entity: entity as AuditLogEntry['entity'],
          details,
          user,
          timestamp: new Date().toISOString(),
        })
      );
    }
  }
}
