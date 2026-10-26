import { storePool } from '../db/mysql.js';
import { AuditService } from './auditService.js';
import { OrderService } from './orderService.js';
import { isOrderRefusal, orderRefusal } from '../utils/checkoutPricing.js';
import {
  applyAgreedPrice,
  priceChangeAllowed,
  PRICE_LOCKED,
  readAgreedChange,
  type AgreedLine,
} from '../utils/agreedPrice.js';

/**
 * Staff agree a delivery charge or a line price. Only a pending order, or an order staff placed
 * that is still confirmed, can change. Tax is worked out again. Stock is not touched.
 */
export class AgreedPriceService {
  static async save(orderId: string, body: unknown, actor: { staffId: number; name: string }) {
    const change = readAgreedChange(body);
    const conn = await storePool.getConnection();
    let orderNumber = '';
    let note = '';
    try {
      await conn.beginTransaction();
      const [orders] = await conn.query<any[]>(
        `SELECT ID as id, OrderNumber as orderNumber, OrderStatus as status, OrderSource as source,
                CAST(ShippingCharges AS DOUBLE) as delivery
         FROM orders WHERE ID = ? OR OrderNumber = ? LIMIT 1 FOR UPDATE`,
        [orderId, orderId]
      );
      const order = orders[0];
      if (!order) throw orderRefusal(404, 'Order not found');
      if (!priceChangeAllowed(order.status, order.source)) throw orderRefusal(409, PRICE_LOCKED);

      const [items] = await conn.query<any[]>(
        `SELECT ID as id, Quantity as quantity, CAST(UnitPrice AS DOUBLE) as unitPrice,
                CAST(LineTotal AS DOUBLE) as lineTotal, CAST(TaxRate AS DOUBLE) as taxRate,
                CAST(TaxAmount AS DOUBLE) as taxAmount, CAST(DiscountAmount AS DOUBLE) as discountAmount
         FROM order_items WHERE OrderID = ? FOR UPDATE`,
        [order.id]
      );
      const lines: AgreedLine[] = items.map((row) => ({
        id: Number(row.id),
        quantity: Number(row.quantity) || 0,
        unitPrice: Number(row.unitPrice) || 0,
        lineTotal: Number(row.lineTotal) || 0,
        taxRate: Number(row.taxRate) || 0,
        taxAmount: Number(row.taxAmount) || 0,
        discountAmount: Number(row.discountAmount) || 0,
      }));
      const next = applyAgreedPrice(lines, Number(order.delivery) || 0, change);
      if (!next.changed) throw orderRefusal(400, 'Nothing on this order changed.');

      await conn.query(
        `UPDATE orders
         SET SubTotal = ?, TaxTotal = ?, DiscountTotal = ?, ShippingCharges = ?, GrandTotal = ?,
             UpdatedDate = CURDATE(), UpdatedTime = CURTIME()
         WHERE ID = ?`,
        [
          next.subtotal.toFixed(2),
          next.tax.toFixed(2),
          next.discount.toFixed(2),
          next.delivery.toFixed(2),
          next.grandTotal.toFixed(2),
          order.id,
        ]
      );
      for (const row of next.lines) {
        if (!row.touched) continue;
        await conn.query(
          `UPDATE order_items
           SET UnitPrice = ?, LineTotal = ?, TaxAmount = ?, DiscountAmount = ?
           WHERE ID = ? AND OrderID = ?`,
          [
            row.unitPrice.toFixed(2),
            row.lineTotal.toFixed(2),
            row.taxAmount.toFixed(2),
            row.discountAmount.toFixed(2),
            row.id,
            order.id,
          ]
        );
      }
      await conn.query(
        `INSERT INTO order_status_history
         (OrderID, OrderStatus, Notes, ChangedBy, CreatedDate, CreatedTime)
         VALUES (?, ?, ?, ?, CURDATE(), CURTIME())`,
        [order.id, order.status, next.note, actor.staffId]
      );
      await conn.commit();
      orderNumber = String(order.orderNumber);
      note = next.note;
    } catch (err) {
      await conn.rollback();
      if (isOrderRefusal(err)) throw err;
      console.warn('[AgreedPrice] save failed', err);
      throw orderRefusal(503, "We couldn't save that price. Nothing was changed.");
    } finally {
      conn.release();
    }

    const saved = await OrderService.getOrderById(orderNumber);
    await AuditService.create({
      action: 'Agreed a price',
      entity: 'order',
      details: `${orderNumber}: ${note}`,
      user: actor.name,
    }).catch((err) => console.warn('[AgreedPrice] audit write failed', err));
    return saved;
  }
}
