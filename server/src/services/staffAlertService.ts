import type { PoolConnection } from 'mysql2/promise';
import { storePool } from '../db/mysql.js';
import { orderRefusal } from '../utils/checkoutPricing.js';
import { can, type Permissions } from '../utils/permissions.js';
import { coversStore, storeFilter, type Scope } from '../utils/scope.js';
import { orderAlert, requestAlert } from '../utils/staffAlert.js';

const NOT_READY = 'Alerts are not ready. Run the staff alerts SQL, then try again.';

export type StaffAlert = {
  id: number;
  kind: 'order' | 'request';
  subjectId: number;
  headline: string;
  detail: string;
  arrivedAt: string;
};

function kindsFor(permissions: Permissions): Array<'order' | 'request'> {
  const kinds: Array<'order' | 'request'> = [];
  if (can(permissions, 'orders', 'view')) kinds.push('order');
  if (can(permissions, 'requests', 'view')) kinds.push('request');
  return kinds;
}

/**
 * A customer order or a Talk to us request tells staff. An order staff place themselves does not.
 * A missing table never stops the order or the request.
 */
export class StaffAlertService {
  static async recordOrder(conn: PoolConnection, orderId: number): Promise<void> {
    try {
      const [rows] = await conn.query<any[]>(
        `SELECT OrderNumber as orderNumber, OrderStatus as status, StoreID as storeId,
                CAST(GrandTotal AS DOUBLE) as grandTotal
         FROM orders WHERE ID = ? LIMIT 1`,
        [orderId]
      );
      const order = rows[0];
      if (!order) return;
      const text = orderAlert({
        orderNumber: String(order.orderNumber),
        status: String(order.status),
        grandTotal: Number(order.grandTotal) || 0,
      });
      await StaffAlertService.insert(conn, {
        kind: 'order',
        storeId: Number(order.storeId) || 0,
        subjectId: orderId,
        ...text,
      });
    } catch (err) {
      console.warn('[StaffAlert] order alert skipped', err);
    }
  }

  static async recordRequest(
    conn: PoolConnection,
    requestId: number,
    storeId: number,
    lineCount: number,
    grandTotal: number
  ): Promise<void> {
    try {
      const text = requestAlert({ id: requestId, lineCount, grandTotal });
      await StaffAlertService.insert(conn, { kind: 'request', storeId, subjectId: requestId, ...text });
    } catch (err) {
      console.warn('[StaffAlert] request alert skipped', err);
    }
  }

  private static async insert(
    conn: PoolConnection,
    row: { kind: 'order' | 'request'; storeId: number; subjectId: number; headline: string; detail: string }
  ): Promise<void> {
    try {
      await conn.query(
        `INSERT INTO staff_alerts
         (Kind, StoreID, SubjectID, Headline, Detail, Seen, CreatedDate, CreatedTime)
         VALUES (?, ?, ?, ?, ?, 0, CURDATE(), CURTIME())`,
        [row.kind, row.storeId, row.subjectId, row.headline, row.detail]
      );
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'ER_DUP_ENTRY' || code === 'ER_NO_SUCH_TABLE') return;
      throw err;
    }
  }

  static async list(scope: Scope, permissions: Permissions): Promise<StaffAlert[]> {
    const kinds = kindsFor(permissions);
    if (!kinds.length) throw orderRefusal(403, "You don't have access to orders or Talk to us.");
    const storeIds = storeFilter(scope);
    if (storeIds && storeIds.length === 0) return [];
    try {
      const params: unknown[] = [kinds];
      let where = 'WHERE Seen = 0 AND Kind IN (?)';
      if (storeIds) {
        where += ' AND StoreID IN (?)';
        params.push(storeIds);
      }
      const [rows] = await storePool.query<any[]>(
        `SELECT ID as id, Kind as kind, SubjectID as subjectId, Headline as headline, Detail as detail,
                CONCAT(CreatedDate, 'T', COALESCE(CreatedTime, '00:00:00'), 'Z') as arrivedAt
         FROM staff_alerts ${where} ORDER BY ID DESC LIMIT 30`,
        params
      );
      return rows.map((row) => ({
        id: Number(row.id),
        kind: row.kind === 'request' ? 'request' : 'order',
        subjectId: Number(row.subjectId),
        headline: String(row.headline),
        detail: String(row.detail),
        arrivedAt: String(row.arrivedAt),
      }));
    } catch (err) {
      if ((err as { code?: string })?.code === 'ER_NO_SUCH_TABLE') {
        throw Object.assign(new Error(NOT_READY), { statusCode: 503 });
      }
      throw err;
    }
  }

  static async see(id: unknown, scope: Scope, permissions: Permissions): Promise<{ id: number; seen: true }> {
    const alertId = Number(id);
    if (!Number.isInteger(alertId) || alertId <= 0) throw orderRefusal(400, 'That alert was not found.');
    const conn = await storePool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query<any[]>(
        `SELECT ID as id, Kind as kind, StoreID as storeId FROM staff_alerts WHERE ID = ? LIMIT 1 FOR UPDATE`,
        [alertId]
      );
      const alert = rows[0];
      if (!alert) throw orderRefusal(404, 'That alert was not found.');
      const kind = alert.kind === 'request' ? 'request' : 'order';
      const module = kind === 'order' ? 'orders' : 'requests';
      if (!can(permissions, module, 'view')) {
        throw orderRefusal(403, "You don't have access to that.");
      }
      if (!coversStore(scope, Number(alert.storeId))) throw orderRefusal(404, 'That alert was not found.');
      await conn.query(`UPDATE staff_alerts SET Seen = 1 WHERE ID = ?`, [alertId]);
      await conn.commit();
      return { id: alertId, seen: true };
    } catch (err) {
      await conn.rollback();
      if ((err as { code?: string })?.code === 'ER_NO_SUCH_TABLE') {
        throw Object.assign(new Error(NOT_READY), { statusCode: 503 });
      }
      throw err;
    } finally {
      conn.release();
    }
  }
}
