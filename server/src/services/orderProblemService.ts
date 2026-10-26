import type { PoolConnection } from 'mysql2/promise';
import { storePool } from '../db/mysql.js';
import { isOrderRefusal, orderRefusal } from '../utils/checkoutPricing.js';
import { readProblemClose, readProblemNote } from '../utils/orderProblem.js';
import { coversStore, type Scope } from '../utils/scope.js';
import { AuditService } from './auditService.js';
import { StaffAlertService } from './staffAlertService.js';

const NOT_READY = 'Problem reports are not ready. Run the delivery promise SQL, then try again.';

export type OrderProblem = { status: 'new' | 'closed'; note: string };

type ProblemOrder = { id: unknown; problem?: OrderProblem | null };

export class OrderProblemService {
  static async report(orderIdRaw: unknown, userId: number, body: unknown): Promise<OrderProblem & { message: string }> {
    const note = readProblemNote(body);
    const orderId = Number(orderIdRaw);
    if (!Number.isInteger(orderId) || orderId <= 0) throw orderRefusal(404, 'Order not found');
    const conn = await storePool.getConnection();
    try {
      await conn.beginTransaction();
      const [orders] = await conn.query<any[]>(
        `SELECT ID as id, UserID as userId, StoreID as storeId, OrderNumber as orderNumber
         FROM orders WHERE ID = ? LIMIT 1 FOR UPDATE`,
        [orderId]
      );
      const order = orders[0];
      if (!order) throw orderRefusal(404, 'Order not found');
      if (Number(order.userId) !== Number(userId)) throw orderRefusal(403, 'Not allowed to view this order');
      const [open] = await conn.query<any[]>(
        `SELECT ID as id FROM order_problems WHERE OrderID = ? AND Status = 'new' LIMIT 1 FOR UPDATE`,
        [orderId]
      );
      if (open.length) throw orderRefusal(409, 'This order already has an open problem.');
      await conn.query(
        `INSERT INTO order_problems (OrderID, StoreID, Note, Status, CreatedDate, CreatedTime)
         VALUES (?, ?, ?, 'new', CURDATE(), CURTIME())`,
        [orderId, Number(order.storeId) || 0, note]
      );
      await StaffAlertService.recordProblem(
        conn,
        orderId,
        String(order.orderNumber),
        Number(order.storeId) || 0,
        note
      );
      await conn.commit();
      return { status: 'new', note, message: 'Staff will look at this. The order is unchanged.' };
    } catch (err) {
      await conn.rollback().catch(() => undefined);
      throw OrderProblemService.failed(err, "We couldn't save that problem. The order is unchanged.");
    } finally {
      conn.release();
    }
  }

  static async close(orderIdRaw: unknown, body: unknown, scope: Scope, actorName: string): Promise<OrderProblem> {
    readProblemClose(body);
    const orderId = Number(orderIdRaw);
    if (!Number.isInteger(orderId) || orderId <= 0) throw orderRefusal(404, 'Order not found');
    const conn = await storePool.getConnection();
    let orderNumber = '';
    let note = '';
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query<any[]>(
        `SELECT p.ID as id, p.StoreID as storeId, p.Note as note, o.OrderNumber as orderNumber
         FROM order_problems p
         JOIN orders o ON o.ID = p.OrderID
         WHERE p.OrderID = ? AND p.Status = 'new'
         ORDER BY p.ID DESC LIMIT 1 FOR UPDATE`,
        [orderId]
      );
      const row = rows[0];
      if (!row || !coversStore(scope, Number(row.storeId))) {
        throw orderRefusal(404, 'This order has no open problem.');
      }
      orderNumber = String(row.orderNumber);
      note = String(row.note);
      await conn.query(`UPDATE order_problems SET Status = 'closed' WHERE ID = ?`, [row.id]);
      await conn.commit();
    } catch (err) {
      await conn.rollback().catch(() => undefined);
      throw OrderProblemService.failed(err, "We couldn't close that problem.");
    } finally {
      conn.release();
    }
    await AuditService.create({
      action: 'Closed a problem',
      entity: 'order',
      details: orderNumber,
      user: actorName,
    }).catch((err) => console.warn('[OrderProblem] audit write failed', err));
    return { status: 'closed', note };
  }

  /** Latest problem on each order. A missing table leaves the field empty. */
  static async attach(orders: ProblemOrder[], conn: Pick<PoolConnection, 'query'> = storePool): Promise<void> {
    const ids = orders.map((order) => Number(order.id)).filter((id) => Number.isInteger(id) && id > 0);
    if (!ids.length) return;
    try {
      const [rows] = await conn.query<any[]>(
        `SELECT p.OrderID as orderId, p.Status as status, p.Note as note
         FROM order_problems p
         INNER JOIN (
           SELECT OrderID, MAX(ID) as id FROM order_problems WHERE OrderID IN (?) GROUP BY OrderID
         ) latest ON latest.id = p.ID`,
        [ids]
      );
      const byId = new Map<number, OrderProblem>(
        rows.map((row) => [
          Number(row.orderId),
          { status: row.status === 'closed' ? 'closed' : 'new', note: String(row.note) },
        ])
      );
      for (const order of orders) order.problem = byId.get(Number(order.id)) ?? null;
    } catch (err) {
      if ((err as { code?: string })?.code === 'ER_NO_SUCH_TABLE') {
        for (const order of orders) order.problem = null;
        return;
      }
      throw err;
    }
  }

  private static failed(err: unknown, fallback: string): unknown {
    if (isOrderRefusal(err) || (err as { statusCode?: number })?.statusCode) return err;
    if ((err as { code?: string })?.code === 'ER_NO_SUCH_TABLE') {
      return Object.assign(new Error(NOT_READY), { statusCode: 503 });
    }
    console.error('[OrderProblem]', err);
    return Object.assign(new Error(fallback), { statusCode: 503 });
  }
}
