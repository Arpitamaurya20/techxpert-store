import { storePool } from '../db/mysql.js';
import { AuditService } from './auditService.js';
import { CartService } from './cartService.js';
import { DeliveryAreaService } from './deliveryAreaService.js';
import { OrderService } from './orderService.js';
import { StoreStockService } from './storeStockService.js';
import { isOrderRefusal, orderRefusal } from '../utils/checkoutPricing.js';
import { lineLimits, quantityRefusal } from '../utils/cartRules.js';
import { coversStore, type Scope } from '../utils/scope.js';
import { readStaffOrder } from '../utils/staffOrder.js';
import { OrderNoticeService } from './orderNoticeService.js';
import { ShopSettingsService } from './shopSettingsService.js';
import { deliveryPromise } from '../utils/deliveryPromise.js';

/**
 * Staff place an order with the same price, stock, pack size, GST and pincode rules as the app.
 * They are the confirmation, so it is confirmed even when a large-order threshold is on,
 * and the cash limit does not refuse it. Stock is taken at once.
 */
export class StaffOrderService {
  static async place(body: unknown, scope: Scope, actor: { staffId: number; name: string }) {
    const input = readStaffOrder(body);
    const { pincode, storeId } = await DeliveryAreaService.assertServiceable(input.pincode);
    if (!coversStore(scope, storeId)) {
      throw orderRefusal(403, 'That pincode is served by a store outside your places.');
    }

    const conn = await storePool.getConnection();
    let orderId = 0;
    try {
      await conn.beginTransaction();
      if (input.requestId) {
        const [requests] = await conn.query<any[]>(
          `SELECT ID as id, StoreID as storeId FROM talk_requests WHERE ID = ? LIMIT 1 FOR UPDATE`,
          [input.requestId]
        );
        const request = requests[0];
        if (!request || !coversStore(scope, Number(request.storeId))) {
          throw orderRefusal(404, 'That request was not found.');
        }
      }

      const rows: any[] = [];
      for (const line of input.lines) {
        const product = await CartService.productForCart(line.productId, conn, true, line.variantId);
        if (!product) throw orderRefusal(409, 'A product in this order is no longer in the catalogue.');
        if (product.variantId == null) {
          throw orderRefusal(
            409,
            line.variantId ? "That option isn't part of this product." : `"${product.name}" isn't available to order right now.`
          );
        }
        if (Number(product.variantActive) !== 1) {
          throw orderRefusal(409, `"${product.name}" isn't available to order right now.`);
        }
        rows.push({ ...product, quantity: line.quantity });
      }
      await StoreStockService.capLines(conn, storeId, rows);
      for (const row of rows) {
        const refusal = quantityRefusal(row.name, Number(row.quantity), lineLimits(row), row.price);
        if (refusal) throw orderRefusal(409, refusal);
      }
      const { lines, totals, taxRate } = await CartService.priceRows(rows);
      for (const line of lines) {
        const refusal = quantityRefusal(line.name, line.quantity, line.limits, line.basePrice);
        if (refusal) throw orderRefusal(409, refusal);
      }

      const userId = await OrderService.customerForStaff(input.phone, input.name);
      const customer = await OrderService.resolveCustomerInfo(userId, {
        name: input.name,
        phone: input.phone,
      });
      const address = input.address.includes(pincode) ? input.address : `${input.address}, ${pincode}`;
      const source = input.requestId ? 'request' : 'staff';
      const notes = input.note ?? (source === 'request' ? `Placed from talk request ${input.requestId}` : 'Placed by staff');
      const settings = await ShopSettingsService.read();
      orderId = await OrderService.writeOrder(conn, {
        storeId,
        userId,
        customer,
        deliveryAddress: address,
        paymentMethod: 'COD',
        notes,
        lines,
        totals,
        taxRate,
        orderStatus: 'confirmed',
        historyNote: notes,
        source,
        createdBy: actor.staffId,
        arrivesInDays: deliveryPromise(settings.deliveryDays),
      });
      if (input.requestId) {
        await conn.query(
          `UPDATE talk_requests SET Status = 'closed', UpdatedDate = CURDATE(), UpdatedTime = CURTIME() WHERE ID = ?`,
          [input.requestId]
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback().catch(() => undefined);
      if (isOrderRefusal(err)) throw err;
      console.error('[StaffOrder] place failed', err);
      throw Object.assign(new Error("We couldn't place that order. Nothing was saved."), { statusCode: 503 });
    } finally {
      conn.release();
    }

    await OrderNoticeService.tell(orderId);
    const order = await OrderService.getOrderById(orderId);
    const source = input.requestId ? 'request' : 'staff';
    await AuditService.create({
      action: 'Placed an order',
      entity: 'order',
      details: `${order?.orderNumber ?? orderId} for ${input.name} (${source})`,
      user: actor.name,
    }).catch((err) => console.warn('[StaffOrder] audit write failed', err));
    return order;
  }
}
