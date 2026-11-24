import { storePool } from '../db/mysql.js';
import {
  mapStoreOrderToActivityItem,
  nextCursorForOrders,
  parseServiceOrdersCursor,
  type ActivityItemV1,
} from '../utils/activityItem.js';
import { OrderService } from './orderService.js';
import type { OrderChannel } from '../utils/orderChannel.js';

export type ServiceOrdersPage = {
  items: ActivityItemV1[];
  nextCursor: string | null;
  meta: { limit: number; contractVersion: number };
};

/**
 * Customer orders for Homecare Activity (S2S). Guest orders excluded.
 * Keyset: `before` = `<ISO>|<store_order:id>` — Store uses the id component (`ID < n`).
 */
export class ServiceOrdersService {
  static async listForCustomer(
    userId: number,
    query: { before?: unknown; limit?: unknown }
  ): Promise<ServiceOrdersPage> {
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 50);
    const cursor = parseServiceOrdersCursor(query.before);

    const params: unknown[] = [userId];
    let where = `WHERE o.UserID = ?`;
    if (cursor) {
      where += ` AND o.ID < ?`;
      params.push(cursor.orderId);
    }

    const [rows] = await storePool.query<any[]>(
      `SELECT
         o.ID as id,
         o.OrderNumber as orderNumber,
         o.OrderStatus as status,
         o.PaymentStatus as paymentStatus,
         o.PaymentMethod as paymentMethod,
         CAST(o.GrandTotal AS DOUBLE) as total,
         CONCAT(o.CreatedDate, 'T', COALESCE(o.CreatedTime, '12:00:00'), 'Z') as placedAt
       FROM orders o
       ${where}
       ORDER BY o.ID DESC
       LIMIT ?`,
      [...params, limit]
    );

    await OrderService.attachChannel(rows as { id: unknown; channel?: OrderChannel | null }[]);

    const items = rows.map((row) =>
      mapStoreOrderToActivityItem({
        id: row.id,
        orderNumber: row.orderNumber,
        status: row.status,
        paymentMethod: row.paymentMethod,
        paymentStatus: row.paymentStatus,
        total: row.total,
        placedAt: row.placedAt,
        channel: row.channel ?? null,
      })
    );

    const nextCursor = rows.length < limit ? null : nextCursorForOrders(items);

    return {
      items,
      nextCursor,
      meta: { limit, contractVersion: 1 },
    };
  }
}
