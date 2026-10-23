import type { PoolConnection } from 'mysql2/promise';
import { storePool, userPool } from '../db/mysql.js';
import { store } from '../db/store.js';
import { mysqlOrFileStore } from '../db/mysqlErrors.js';
import { AuthService } from './authService.js';
import { CartService, type CheckoutLine } from './cartService.js';
import { guestOrderOwner, isOrderRefusal, orderFailed, orderRefusal } from '../utils/checkoutPricing.js';
import { quantityRefusal, TAX_RATE, type CartTotals } from '../utils/cartRules.js';
import { deliveryPincode } from '../utils/pincode.js';
import { DeliveryAreaService } from './deliveryAreaService.js';

export interface OrderFilterParams {
  userId?: number;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
  isPortal?: boolean;
}

export class OrderService {
  static async getOrders(params: OrderFilterParams) {
    const limit = Math.min(Number(params.limit) || 50, 100);
    const page = Math.max(Number(params.page) || 1, 1);
    const offset = (page - 1) * limit;

    try {
      let whereClause = `WHERE 1=1`;
      const queryParams: any[] = [];

      if (!params.isPortal && params.userId) {
        whereClause += ` AND o.UserID = ?`;
        queryParams.push(params.userId);
      }

      if (params.status) {
        whereClause += ` AND o.OrderStatus = ?`;
        queryParams.push(params.status);
      }

      if (params.search) {
        whereClause += ` AND (o.OrderNumber LIKE ? OR u.full_name LIKE ? OR u.phone LIKE ? OR o.ShippingAddress LIKE ?)`;
        const s = `%${params.search}%`;
        queryParams.push(s, s, s, s);
      }

      // Same-host cross-DB JOIN: techxpertstore.orders + homecare.users (see docs/ARCHITECTURE.md §4)
      const countSql = `
        SELECT COUNT(*) as total 
        FROM orders o 
        LEFT JOIN homecare.users u ON o.UserID = u.user_id 
        ${whereClause}
      `;
      const [countRows] = await storePool.query<any[]>(countSql, queryParams);
      const total = countRows[0]?.total || 0;

      const orderSql = `
        SELECT 
          o.ID as id,
          o.OrderNumber as orderNumber,
          o.UserID as userId,
          CONCAT(o.CreatedDate, 'T', COALESCE(o.CreatedTime, '12:00:00'), 'Z') as placedAt,
          o.OrderStatus as status,
          o.PaymentStatus as paymentStatus,
          o.PaymentMethod as paymentMethod,
          CAST(o.GrandTotal AS DOUBLE) as total,
          CAST(o.SubTotal AS DOUBLE) as subtotal,
          CAST(o.TaxTotal AS DOUBLE) as taxTotal,
          o.ShippingAddress as deliveryAddress,
          COALESCE(u.full_name, o.GuestName, 'Valued Customer') as customerName,
          COALESCE(u.phone, o.GuestPhone, '') as customerMobile,
          COALESCE(u.email, o.GuestEmail, '') as customerEmail
        FROM orders o
        LEFT JOIN homecare.users u ON o.UserID = u.user_id
        ${whereClause}
        ORDER BY o.ID DESC
        LIMIT ? OFFSET ?
      `;

      const [orders] = await storePool.query<any[]>(orderSql, [...queryParams, limit, offset]);

      // Populate line items
      for (const order of orders) {
        const [items] = await storePool.query<any[]>(
          `SELECT 
             oi.ID as id,
             oi.ProductID as productId,
             oi.VariantID as variantId,
             COALESCE(p.ProductName, 'Construction Material') as name,
             COALESCE(p.ProductCode, 'SKU') as sku,
             oi.Quantity as quantity,
             CAST(oi.UnitPrice AS DOUBLE) as unitPrice,
             CAST(oi.LineTotal AS DOUBLE) as lineTotal,
             COALESCE(mu.UnitName, 'unit') as unit
           FROM order_items oi
           LEFT JOIN products p ON oi.ProductID = p.ID
           LEFT JOIN measurement_units mu ON p.MeasurementUnitID = mu.ID
           WHERE oi.OrderID = ?`,
          [order.id]
        );
        order.items = items;
      }

      return {
        orders,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (err) {
      // Same-host JOIN to homecare.users may fail if identity DB is missing — retry store-only
      try {
        return await OrderService.getOrdersWithoutUserJoin(params, limit, page, offset);
      } catch (err2) {
        return mysqlOrFileStore('orders.getOrders', err2, () => {
          const fallback = store.getOrders(
            params.isPortal ? undefined : params.userId ? String(params.userId) : undefined
          );
          return {
            orders: fallback,
            meta: { page: 1, limit, total: fallback.length, totalPages: 1 },
          };
        });
      }
    }
  }

  /** Store-only orders list when cross-DB JOIN to homecare is unavailable. */
  private static async getOrdersWithoutUserJoin(
    params: OrderFilterParams,
    limit: number,
    page: number,
    offset: number
  ) {
    let whereClause = `WHERE 1=1`;
    const queryParams: any[] = [];
    if (!params.isPortal && params.userId) {
      whereClause += ` AND o.UserID = ?`;
      queryParams.push(params.userId);
    }
    if (params.status) {
      whereClause += ` AND o.OrderStatus = ?`;
      queryParams.push(params.status);
    }
    if (params.search) {
      whereClause += ` AND (o.OrderNumber LIKE ? OR o.ShippingAddress LIKE ? OR o.GuestName LIKE ? OR o.GuestPhone LIKE ?)`;
      const s = `%${params.search}%`;
      queryParams.push(s, s, s, s);
    }

    const [countRows] = await storePool.query<any[]>(
      `SELECT COUNT(*) as total FROM orders o ${whereClause}`,
      queryParams
    );
    const total = countRows[0]?.total || 0;
    const [orders] = await storePool.query<any[]>(
      `SELECT 
         o.ID as id,
         o.OrderNumber as orderNumber,
         o.UserID as userId,
         CONCAT(o.CreatedDate, 'T', COALESCE(o.CreatedTime, '12:00:00'), 'Z') as placedAt,
         o.OrderStatus as status,
         o.PaymentStatus as paymentStatus,
         o.PaymentMethod as paymentMethod,
         CAST(o.GrandTotal AS DOUBLE) as total,
         CAST(o.SubTotal AS DOUBLE) as subtotal,
         CAST(o.TaxTotal AS DOUBLE) as taxTotal,
         o.ShippingAddress as deliveryAddress,
         COALESCE(o.GuestName, 'Valued Customer') as customerName,
         COALESCE(o.GuestPhone, '') as customerMobile,
         COALESCE(o.GuestEmail, '') as customerEmail
       FROM orders o
       ${whereClause}
       ORDER BY o.ID DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    );
    for (const order of orders) {
      const [items] = await storePool.query<any[]>(
        `SELECT 
           oi.ID as id,
           oi.ProductID as productId,
           oi.VariantID as variantId,
           COALESCE(p.ProductName, 'Construction Material') as name,
           COALESCE(p.ProductCode, 'SKU') as sku,
           oi.Quantity as quantity,
           CAST(oi.UnitPrice AS DOUBLE) as unitPrice,
           CAST(oi.LineTotal AS DOUBLE) as lineTotal,
           COALESCE(mu.UnitName, 'unit') as unit
         FROM order_items oi
         LEFT JOIN products p ON oi.ProductID = p.ID
         LEFT JOIN measurement_units mu ON p.MeasurementUnitID = mu.ID
         WHERE oi.OrderID = ?`,
        [order.id]
      );
      order.items = items;
    }
    return {
      orders,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  static async getOrderById(orderId: string | number) {
    try {
      const [rows] = await storePool.query<any[]>(
        `SELECT 
           o.ID as id,
           o.OrderNumber as orderNumber,
           o.UserID as userId,
           CONCAT(o.CreatedDate, 'T', COALESCE(o.CreatedTime, '12:00:00'), 'Z') as placedAt,
           o.OrderStatus as status,
           o.PaymentStatus as paymentStatus,
           o.PaymentMethod as paymentMethod,
           CAST(o.GrandTotal AS DOUBLE) as total,
           CAST(o.SubTotal AS DOUBLE) as subtotal,
           CAST(o.TaxTotal AS DOUBLE) as taxTotal,
           o.ShippingAddress as deliveryAddress,
           COALESCE(u.full_name, o.GuestName, 'Valued Customer') as customerName,
           COALESCE(u.phone, o.GuestPhone, '') as customerMobile,
           COALESCE(u.email, o.GuestEmail, '') as customerEmail
         FROM orders o
         LEFT JOIN homecare.users u ON o.UserID = u.user_id
         WHERE o.ID = ? OR o.OrderNumber = ?
         LIMIT 1`,
        [orderId, orderId]
      );

      if (rows.length > 0) {
        const order = rows[0];
        const [items] = await storePool.query<any[]>(
          `SELECT 
             oi.ID as id,
             oi.ProductID as productId,
             oi.VariantID as variantId,
             COALESCE(p.ProductName, 'Construction Material') as name,
             COALESCE(p.ProductCode, 'SKU') as sku,
             oi.Quantity as quantity,
             CAST(oi.UnitPrice AS DOUBLE) as unitPrice,
             CAST(oi.LineTotal AS DOUBLE) as lineTotal,
             COALESCE(mu.UnitName, 'unit') as unit
           FROM order_items oi
           LEFT JOIN products p ON oi.ProductID = p.ID
           LEFT JOIN measurement_units mu ON p.MeasurementUnitID = mu.ID
           WHERE oi.OrderID = ?`,
          [order.id]
        );
        order.items = items;

        const [history] = await storePool.query<any[]>(
          `SELECT ID as id, OrderStatus as status, PaymentStatus as paymentStatus, Notes as notes, CreatedDate as date, CreatedTime as time
           FROM order_status_history WHERE OrderID = ? ORDER BY ID ASC`,
          [order.id]
        );
        order.history = history;

        return order;
      }
      return null;
    } catch (err) {
      return mysqlOrFileStore('orders.getOrderById', err, () =>
        store.getOrders().find((o) => o.id === String(orderId) || o.orderNumber === String(orderId))
      );
    }
  }

  static async resolveDeliveryAddress(
    userId?: number,
    addressId?: number,
    fallbackAddress?: string
  ): Promise<{ addressString: string; addressDetails?: any }> {
    if (addressId && userId) {
      try {
        const [rows] = await userPool.query<any[]>(
          `SELECT address_id as id, label, flat_no, building, area, city, pincode 
           FROM homecare.user_addresses 
           WHERE address_id = ? AND user_id = ? AND is_deleted = 0 LIMIT 1`,
          [addressId, userId]
        );
        if (rows.length > 0) {
          const a = rows[0];
          const parts = [a.flat_no, a.building, a.area, `${a.city} - ${a.pincode}`].filter(Boolean);
          const formatted = parts.join(', ') + (a.label ? ` (${a.label})` : '');
          return { addressString: formatted, addressDetails: a };
        }
      } catch (err) {
        console.warn('[OrderService] resolve address by ID failed', err);
      }
    }

    // The address typed at checkout beats the saved default.
    if (fallbackAddress?.trim()) {
      return { addressString: fallbackAddress.trim() };
    }

    if (userId) {
      try {
        const [rows] = await userPool.query<any[]>(
          `SELECT address_id as id, label, flat_no, building, area, city, pincode 
           FROM homecare.user_addresses 
           WHERE user_id = ? AND is_deleted = 0 
           ORDER BY is_default DESC, address_id DESC LIMIT 1`,
          [userId]
        );
        if (rows.length > 0) {
          const a = rows[0];
          const parts = [a.flat_no, a.building, a.area, `${a.city} - ${a.pincode}`].filter(Boolean);
          const formatted = parts.join(', ') + (a.label ? ` (${a.label})` : '');
          return { addressString: formatted, addressDetails: a };
        }
      } catch (err) {
        console.warn('[OrderService] resolve default address failed', err);
      }
    }

    throw orderRefusal(400, 'Add a delivery address with a 6-digit pincode.');
  }

  static async resolveCustomerInfo(
    userId?: number,
    guestInfo?: { name?: string; phone?: string; email?: string }
  ): Promise<{ name: string; phone: string; email: string }> {
    if (userId) {
      try {
        const [rows] = await userPool.query<any[]>(
          `SELECT full_name, phone, email FROM homecare.users WHERE user_id = ? LIMIT 1`,
          [userId]
        );
        if (rows.length > 0) {
          const u = rows[0];
          const name = AuthService.isPlaceholderName(u.full_name)
            ? guestInfo?.name || u.full_name || 'Customer'
            : u.full_name;
          const phone = u.phone || guestInfo?.phone || '';
          const email = u.email || guestInfo?.email || '';
          try {
            await AuthService.persistCustomerContact(userId, {
              name: guestInfo?.name,
              phone: guestInfo?.phone || phone,
              email: guestInfo?.email,
            });
          } catch (persistErr) {
            console.warn('[OrderService] persist customer contact failed', persistErr);
          }
          return { name, phone, email };
        }
      } catch (err) {
        console.warn('[OrderService] resolveCustomerInfo failed', err);
      }
    }

    return {
      name: guestInfo?.name || 'Valued Customer',
      phone: guestInfo?.phone || '',
      email: guestInfo?.email || '',
    };
  }

  /**
   * The customer who owns a guest's order. An unregistered 10-digit phone gets a new unverified
   * customer; a phone that already has an account stays a guest order and the account is not touched.
   */
  static async ownerForGuest(guest: { name?: string; phone?: string; email?: string }): Promise<number | undefined> {
    const phone = AuthService.cleanPhone(guest.phone);
    try {
      const [existing] =
        phone.length === 10
          ? await userPool.query<any[]>(`SELECT user_id FROM users WHERE phone = ? LIMIT 1`, [phone])
          : [[]];
      const existingId = existing.length ? Number(existing[0].user_id) : null;
      if (guestOrderOwner(phone, existingId) === 'guest') return undefined;

      const name = String(guest.name || '').trim();
      const storedName = name && !AuthService.isPlaceholderName(name) ? name.slice(0, 200) : null;
      const email = String(guest.email || '').trim();
      const [insertRes] = await userPool.query<any>(
        `INSERT INTO users (phone, full_name, email, is_active, is_verified) VALUES (?, ?, ?, 1, 0)`,
        [phone, storedName, email.includes('@') ? email.slice(0, 200) : null]
      );
      return Number(insertRes.insertId);
    } catch (err) {
      console.warn('[OrderService] guest customer record failed; placing a guest order', err);
      return undefined;
    }
  }

  /**
   * Writes the order, its lines and first history entry, and takes the stock, on the caller's
   * transaction. Lines must already be priced and checked.
   */
  static async writeOrder(
    conn: PoolConnection,
    order: {
      cartId?: number | null;
      userId?: number;
      customer: { name: string; phone: string; email: string };
      deliveryAddress: string;
      paymentMethod: string;
      notes: string;
      lines: CheckoutLine[];
      totals: CartTotals;
    }
  ): Promise<number> {
    const orderNumber = `TX-ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const orderStatus = 'confirmed';
    const paymentStatus = 'pending';
    const { totals } = order;

    const [orderRes] = await conn.query<any>(
      `INSERT INTO orders
       (OrderNumber, UserID, CartID, GuestName, GuestPhone, GuestEmail, ShippingAddress, SubTotal, TaxTotal, DiscountTotal, ShippingCharges, GrandTotal, OrderStatus, PaymentStatus, PaymentMethod, CreatedDate, CreatedTime, CreatedBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), CURTIME(), ?)`,
      [
        orderNumber,
        order.userId || null,
        order.cartId || null,
        order.customer.name,
        order.customer.phone,
        order.customer.email,
        order.deliveryAddress,
        totals.subtotal.toFixed(2),
        totals.tax.toFixed(2),
        totals.bulkSavings.toFixed(2),
        totals.delivery.toFixed(2),
        totals.grandTotal.toFixed(2),
        orderStatus,
        paymentStatus,
        order.paymentMethod,
        order.userId || 1,
      ]
    );
    const orderId = Number(orderRes.insertId);

    for (const line of order.lines) {
      await conn.query(
        `INSERT INTO order_items
         (OrderID, VariantID, ProductID, Quantity, UnitPrice, TaxRate, TaxAmount, DiscountAmount, LineTotal, CreatedDate, CreatedTime)
         VALUES (?, ?, ?, ?, ?, 18.00, ?, ?, ?, CURDATE(), CURTIME())`,
        [
          orderId,
          line.variantId,
          Number(line.productId),
          line.quantity,
          Number(line.unitPrice).toFixed(2),
          (line.lineTotal * TAX_RATE).toFixed(2),
          line.savings.toFixed(2),
          line.lineTotal.toFixed(2),
        ]
      );
      await conn.query(
        `UPDATE product_variants
         SET StockQuantity = GREATEST(0, StockQuantity - ?), UpdatedDate = CURDATE(), UpdatedTime = CURTIME()
         WHERE ID = ?`,
        [line.quantity, line.variantId]
      );
      await conn.query(
        `UPDATE inventory_stock
         SET StockQuantity = GREATEST(0, StockQuantity - ?), LastStockOutDate = CURDATE(), UpdatedDate = CURDATE(), UpdatedTime = CURTIME()
         WHERE VariantID = ?`,
        [line.quantity, line.variantId]
      );
      await conn.query(
        `UPDATE products
         SET StockStatus = 'out_of_stock', UpdatedDate = CURDATE(), UpdatedTime = CURTIME()
         WHERE ID = ? AND (SELECT COALESCE(SUM(StockQuantity), 0) FROM product_variants WHERE ProductID = ?) <= 0`,
        [Number(line.productId), Number(line.productId)]
      );
    }

    await conn.query(
      `INSERT INTO order_status_history
       (OrderID, OrderStatus, PaymentStatus, Notes, ChangedBy, CreatedDate, CreatedTime)
       VALUES (?, ?, ?, ?, ?, CURDATE(), CURTIME())`,
      [orderId, orderStatus, paymentStatus, order.notes, order.userId || 1]
    );
    return orderId;
  }

  /** What the customer is shown for a placed order; the same body for a first answer and a repeat. */
  static async receipt(orderId: number, conn: Pick<PoolConnection, 'query'> = storePool) {
    const [rows] = await conn.query<any[]>(
      `SELECT o.ID as id, o.OrderNumber as orderNumber,
              UNIX_TIMESTAMP(TIMESTAMP(o.CreatedDate, COALESCE(o.CreatedTime, '00:00:00'))) as placedEpoch,
              o.OrderStatus as status, o.PaymentStatus as paymentStatus, o.PaymentMethod as paymentMethod,
              o.GuestName as customerName, o.ShippingAddress as deliveryAddress,
              CAST(o.SubTotal AS DOUBLE) as subtotal, CAST(o.DiscountTotal AS DOUBLE) as bulkSavings,
              CAST(o.ShippingCharges AS DOUBLE) as delivery, CAST(o.TaxTotal AS DOUBLE) as tax,
              CAST(o.GrandTotal AS DOUBLE) as grandTotal
       FROM orders o WHERE o.ID = ? LIMIT 1`,
      [orderId]
    );
    const o = rows[0];
    if (!o) throw orderRefusal(409, 'We could not find that order.');
    const [items] = await conn.query<any[]>(
      `SELECT oi.ProductID as productId, COALESCE(p.ProductName, 'Product') as name,
              COALESCE(mu.UnitName, 'unit') as unit, oi.Quantity as quantity,
              CAST(oi.UnitPrice AS DOUBLE) as unitPrice, CAST(oi.LineTotal AS DOUBLE) as lineTotal
       FROM order_items oi
       LEFT JOIN products p ON p.ID = oi.ProductID
       LEFT JOIN measurement_units mu ON mu.ID = p.MeasurementUnitID
       WHERE oi.OrderID = ? ORDER BY oi.ID ASC`,
      [orderId]
    );
    return {
      id: String(o.id),
      orderNumber: String(o.orderNumber),
      placedAt: new Date(Number(o.placedEpoch) * 1000).toISOString(),
      status: o.status,
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod,
      customerName: o.customerName,
      deliveryAddress: o.deliveryAddress,
      lines: items.map((it) => ({ ...it, productId: String(it.productId) })),
      totals: {
        subtotal: o.subtotal,
        bulkSavings: o.bulkSavings,
        delivery: o.delivery,
        tax: o.tax,
        grandTotal: o.grandTotal,
      },
      total: o.grandTotal,
      shippingCharges: o.delivery,
    };
  }

  /**
   * Older clients: an order from an item list (`POST /orders`). Priced and checked with the same
   * rules as the cart; the shop sells each product's first variant.
   */
  static async checkout(payload: {
    userId?: number;
    items?: Array<{ productId: number; quantity: number }>;
    addressId?: number;
    shippingAddress?: string;
    paymentMethod?: string;
    notes?: string;
    guestName?: string;
    guestPhone?: string;
    guestEmail?: string;
    pincode?: string;
  }) {
    const paymentMethod = String(payload.paymentMethod || 'COD').toUpperCase();
    if (paymentMethod !== 'COD') throw orderRefusal(400, 'Only cash on delivery is available.');
    const items = Array.isArray(payload.items) ? payload.items : [];
    if (items.length === 0) throw orderRefusal(400, 'Order must contain at least one item');

    const address = await this.resolveDeliveryAddress(payload.userId, payload.addressId, payload.shippingAddress);
    await DeliveryAreaService.assertServiceable(
      deliveryPincode(address.addressDetails?.pincode ?? payload.pincode, address.addressString)
    );

    const conn = await storePool.getConnection();
    try {
      await conn.beginTransaction();

      const rows: any[] = [];
      for (const item of items) {
        const productId = Number(item.productId);
        const product = Number.isInteger(productId) && productId > 0
          ? await CartService.productForCart(productId, conn, true)
          : null;
        if (!product) throw orderRefusal(409, 'A product in this order is no longer in the catalogue');
        if (product.variantId == null) {
          throw orderRefusal(409, `"${product.name}" isn't available to order right now.`);
        }
        const quantity = Number(item.quantity);
        if (!Number.isInteger(quantity) || quantity < 1) {
          throw orderRefusal(400, 'Quantity must be a whole number of at least 1.');
        }
        rows.push({ ...product, quantity });
      }

      const { lines, totals } = await CartService.priceRows(rows);
      for (const line of lines) {
        const refusal = quantityRefusal(line.name, line.quantity, line.limits, line.basePrice);
        if (refusal) throw orderRefusal(409, refusal);
      }

      const userId = payload.userId ?? (await this.ownerForGuest({
        name: payload.guestName,
        phone: payload.guestPhone,
        email: payload.guestEmail,
      }));
      const customer = await this.resolveCustomerInfo(userId, {
        name: payload.guestName,
        phone: payload.guestPhone,
        email: payload.guestEmail,
      });

      const orderId = await this.writeOrder(conn, {
        userId,
        customer,
        deliveryAddress: address.addressString,
        paymentMethod,
        notes: payload.notes || 'Order placed directly via Buy Now',
        lines,
        totals,
      });
      await conn.commit();
      return this.receipt(orderId);
    } catch (err) {
      await conn.rollback().catch(() => undefined);
      if (isOrderRefusal(err)) throw err;
      console.error('[OrderService] checkout failed', err);
      throw orderFailed();
    } finally {
      conn.release();
    }
  }

  /** `POST /orders`. The customer is only ever the signed-in user; a database failure is never a pretend order. */
  static async createOrder(orderData: any, userId?: number) {
    const { userId: _ignored, cartId: _cartId, ...rest } = orderData ?? {};
    return this.checkout({ ...rest, userId });
  }

  static async updateOrderStatus(orderId: string | number, status: string, note?: string, actorId: number = 1) {
    try {
      await storePool.query(
        `UPDATE orders 
         SET OrderStatus = ?, UpdatedDate = CURDATE(), UpdatedTime = CURTIME()
         WHERE ID = ? OR OrderNumber = ?`,
        [status, orderId, orderId]
      );

      const [orders] = await storePool.query<any[]>(
        `SELECT ID FROM orders WHERE ID = ? OR OrderNumber = ? LIMIT 1`,
        [orderId, orderId]
      );

      if (orders.length > 0) {
        await storePool.query(
          `INSERT INTO order_status_history
           (OrderID, OrderStatus, Notes, ChangedBy, CreatedDate, CreatedTime)
           VALUES (?, ?, ?, ?, CURDATE(), CURTIME())`,
          [orders[0].ID, status, note || 'Status updated from admin operations portal', actorId]
        );
      }

      return { success: true, status };
    } catch (err) {
      return mysqlOrFileStore('orders.updateOrderStatus', err, () => {
        const updated = store.updateOrderStatus(String(orderId), status as any);
        if (!updated) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
        return { success: true, status };
      });
    }
  }

  static async getOrderStats() {
    try {
      const [rows] = await storePool.query<any[]>(
        `SELECT 
           COUNT(*) as totalOrders,
           COALESCE(SUM(GrandTotal), 0) as totalRevenue,
           SUM(CASE WHEN OrderStatus = 'pending' THEN 1 ELSE 0 END) as pendingCount,
           SUM(CASE WHEN OrderStatus = 'processing' THEN 1 ELSE 0 END) as processingCount,
           SUM(CASE WHEN OrderStatus = 'shipped' THEN 1 ELSE 0 END) as shippedCount,
           SUM(CASE WHEN OrderStatus = 'delivered' THEN 1 ELSE 0 END) as deliveredCount,
           SUM(CASE WHEN OrderStatus = 'cancelled' THEN 1 ELSE 0 END) as cancelledCount
         FROM orders`
      );
      return rows[0];
    } catch (err) {
      return { totalOrders: 0, totalRevenue: 0, pendingCount: 0, processingCount: 0, shippedCount: 0, deliveredCount: 0 };
    }
  }
}
