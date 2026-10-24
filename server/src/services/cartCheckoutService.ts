import { storePool } from '../db/mysql.js';
import { CartService, type CartAccess } from './cartService.js';
import { OrderService } from './orderService.js';
import { DeliveryAreaService } from './deliveryAreaService.js';
import { isOrderRefusal, orderFailed, orderRefusal } from '../utils/checkoutPricing.js';
import { quantityRefusal, sameMoney } from '../utils/cartRules.js';
import { deliveryPincode } from '../utils/pincode.js';
import { StoreStockService } from './storeStockService.js';

export type CartCheckoutRequest = {
  cartId?: unknown;
  expectedTotal?: unknown;
  addressId?: unknown;
  shippingAddress?: unknown;
  pincode?: unknown;
  paymentMethod?: unknown;
  notes?: unknown;
  guestName?: unknown;
  guestPhone?: unknown;
  guestEmail?: unknown;
};

type Placed = { order: Awaited<ReturnType<typeof OrderService.receipt>>; replay: boolean };

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

export class CartCheckoutService {
  /**
   * Turns the caller's server cart into a cash-on-delivery order. Checking out a cart that already
   * became an order returns that order, so a double tap or a retry never makes a second one.
   */
  static async place(access: CartAccess, body: CartCheckoutRequest): Promise<Placed> {
    const paymentMethod = String(body.paymentMethod ?? 'COD').toUpperCase();
    if (paymentMethod !== 'COD') throw orderRefusal(400, 'Only cash on delivery is available.');
    const expectedTotal = Number(body.expectedTotal);
    if (body.expectedTotal == null || body.expectedTotal === '' || !Number.isFinite(expectedTotal)) {
      throw orderRefusal(400, 'expectedTotal is required: the total shown to the customer.');
    }

    let cartId: number;
    if (body.cartId != null && body.cartId !== '') {
      cartId = Number(body.cartId);
      if (!Number.isInteger(cartId) || cartId <= 0) throw orderRefusal(400, 'cartId must be a cart number.');
      const cart = await CartService.assertCartAccess(cartId, access.userId, access.sessionId);
      if (cart.status === 'ordered') return { order: await CartCheckoutService.orderFromCart(cartId), replay: true };
    } else {
      cartId = (await CartService.activeCart(access)).id;
    }

    const guest = { name: text(body.guestName), phone: text(body.guestPhone), email: text(body.guestEmail) };
    const addressId = Number(body.addressId) > 0 ? Number(body.addressId) : undefined;
    const address = await OrderService.resolveDeliveryAddress(access.userId, addressId, text(body.shippingAddress));
    const { storeId } = await DeliveryAreaService.assertServiceable(
      deliveryPincode(address.addressDetails?.pincode ?? text(body.pincode), address.addressString)
    );

    const conn = await storePool.getConnection();
    try {
      await conn.beginTransaction();

      const [carts] = await conn.query<any[]>(`SELECT Status as status FROM carts WHERE ID = ? FOR UPDATE`, [cartId]);
      const status = carts[0]?.status;
      if (status === 'ordered') {
        await conn.commit();
        return { order: await CartCheckoutService.orderFromCart(cartId), replay: true };
      }
      if (status === 'merged') throw orderRefusal(409, 'This cart was moved to your account. Open the cart again.');
      if (status !== 'active') throw orderRefusal(409, 'This cart is no longer open. Open the cart again.');

      const rows = await CartService.cartRows(cartId, conn, true);
      if (rows.length === 0) throw orderRefusal(400, 'Your cart is empty.');

      await StoreStockService.capLines(conn, storeId, rows);
      const { lines, totals, taxRate } = await CartService.priceRows(rows);
      for (const line of lines) {
        if (!line.problem) continue;
        const reason =
          quantityRefusal(line.name, line.quantity, line.limits, line.basePrice) ??
          `"${line.name}" can't be ordered as it is. Check your cart.`;
        throw orderRefusal(409, reason);
      }
      if (!sameMoney(totals.grandTotal, expectedTotal)) {
        throw orderRefusal(
          409,
          'Prices changed since you opened checkout. Check the new total and place the order again.'
        );
      }

      const userId = access.userId ?? (await OrderService.ownerForGuest(guest));
      const customer = await OrderService.resolveCustomerInfo(userId, guest);
      const orderId = await OrderService.writeOrder(conn, {
        cartId,
        storeId,
        userId,
        customer,
        deliveryAddress: address.addressString,
        paymentMethod,
        notes: text(body.notes) ?? 'Order placed from the cart',
        lines,
        totals,
        taxRate,
      });

      await conn.query(`DELETE FROM cart_items WHERE CartID = ?`, [cartId]);
      await conn.query(
        `UPDATE carts SET Status = 'ordered', UpdatedDate = CURDATE(), UpdatedTime = CURTIME() WHERE ID = ?`,
        [cartId]
      );
      await conn.commit();
      return { order: await OrderService.receipt(orderId), replay: false };
    } catch (err: any) {
      await conn.rollback().catch(() => undefined);
      if (err?.code === 'ER_DUP_ENTRY' && /uq_orders_cart/.test(String(err?.message))) {
        return { order: await CartCheckoutService.orderFromCart(cartId), replay: true };
      }
      if (isOrderRefusal(err)) throw err;
      console.error('[CartCheckout] order failed', err);
      throw orderFailed();
    } finally {
      conn.release();
    }
  }

  private static async orderFromCart(cartId: number) {
    const [rows] = await storePool.query<any[]>(`SELECT ID as id FROM orders WHERE CartID = ? LIMIT 1`, [cartId]);
    if (!rows.length) throw orderRefusal(409, 'This cart is no longer open. Open the cart again.');
    return OrderService.receipt(Number(rows[0].id));
  }
}
