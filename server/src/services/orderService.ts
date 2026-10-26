import type { PoolConnection } from 'mysql2/promise';
import { storePool, userPool } from '../db/mysql.js';
import { store } from '../db/store.js';
import { mysqlOrFileStore } from '../db/mysqlErrors.js';
import { AuthService } from './authService.js';
import { CartService, type CheckoutLine } from './cartService.js';
import { guestOrderOwner, isOrderRefusal, orderFailed, orderRefusal } from '../utils/checkoutPricing.js';
import { quantityRefusal, TAX_RATE, type CartTotals } from '../utils/cartRules.js';
import { deliveryPincode } from '../utils/pincode.js';
import type { OrderStatus } from '../utils/validate.js';
import { orderAgainItem, orderAgainLimit, restocksOnCancel, statusChangeRefusal, type OrderAgainSource } from '../utils/orderRules.js';
import { allocateCatalogueStock } from '../utils/stockAllocation.js';
import { VARIANT_SELLING_PRICE } from '../utils/variants.js';
import { DeliveryAreaService } from './deliveryAreaService.js';
import { StoreStockService } from './storeStockService.js';
import { orderSource, type OrderSource } from '../utils/staffOrder.js';
import { ShopSettingsService } from './shopSettingsService.js';
import { checkoutPlacement } from '../utils/shopSettings.js';
import { StaffAlertService } from './staffAlertService.js';
import { OrderNoticeService } from './orderNoticeService.js';
import { orderAccepted } from '../utils/orderNotice.js';

export interface OrderFilterParams {
  userId?: number;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
  isPortal?: boolean;
  /** Portal staff limited to some stores; null or absent = no store filter. */
  storeIds?: number[] | null;
}

function storeClause(storeIds: number[] | null | undefined, params: any[]): string {
  if (!storeIds) return '';
  if (!storeIds.length) return ` AND 1 = 0`;
  params.push(storeIds);
  return ` AND o.StoreID IN (?)`;
}

/** Older orders stored placeholders such as "Valued Customer"; staff should see that no name was given. */
function givenName(name: unknown): string | null {
  return AuthService.isPlaceholderName(name) ? null : String(name);
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
      whereClause += storeClause(params.storeIds, queryParams);

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
          o.OrderSource as source,
          CAST(o.GrandTotal AS DOUBLE) as total,
          CAST(o.SubTotal AS DOUBLE) as subtotal,
          CAST(o.TaxTotal AS DOUBLE) as taxTotal,
          CAST(o.ShippingCharges AS DOUBLE) as deliveryCharge,
          CAST(o.DiscountTotal AS DOUBLE) as discountTotal,
          o.ShippingAddress as deliveryAddress,
          o.StoreID as storeId,
          st.StoreName as storeName,
          COALESCE(NULLIF(u.full_name, ''), NULLIF(o.GuestName, '')) as customerName,
          COALESCE(u.phone, o.GuestPhone, '') as customerMobile,
          COALESCE(u.email, o.GuestEmail, '') as customerEmail
        FROM orders o
        LEFT JOIN homecare.users u ON o.UserID = u.user_id
        LEFT JOIN stores st ON st.ID = o.StoreID
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
             p.ProductCode as sku,
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
        order.customerName = givenName(order.customerName);
      }
      if (params.isPortal) await OrderNoticeService.attach(orders);

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
          if (params.storeIds) return { orders: [], meta: { page: 1, limit, total: 0, totalPages: 0 } };
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
    whereClause += storeClause(params.storeIds, queryParams);
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
         o.OrderSource as source,
         CAST(o.GrandTotal AS DOUBLE) as total,
         CAST(o.SubTotal AS DOUBLE) as subtotal,
         CAST(o.TaxTotal AS DOUBLE) as taxTotal,
          CAST(o.ShippingCharges AS DOUBLE) as deliveryCharge,
          CAST(o.DiscountTotal AS DOUBLE) as discountTotal,
         o.ShippingAddress as deliveryAddress,
         o.StoreID as storeId,
         st.StoreName as storeName,
         NULLIF(o.GuestName, '') as customerName,
         COALESCE(o.GuestPhone, '') as customerMobile,
         COALESCE(o.GuestEmail, '') as customerEmail
       FROM orders o
       LEFT JOIN stores st ON st.ID = o.StoreID
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
           p.ProductCode as sku,
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
      order.customerName = givenName(order.customerName);
    }
    if (params.isPortal) await OrderNoticeService.attach(orders);
    return {
      orders,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Products this customer ordered, one row each, most recent first.
   * Price and stock are today's, and a product that can no longer be bought stays in the list with a reason.
   * Cancelled orders don't count.
   */
  static async getOrderAgain(userId: number, askedLimit: unknown) {
    const limit = orderAgainLimit(askedLimit);
    const [rows] = await storePool.query<any[]>(
      `SELECT
         oi.ProductID as productId,
         oi.Quantity as lastQuantity,
         CONCAT(o.CreatedDate, 'T', COALESCE(o.CreatedTime, '12:00:00'), 'Z') as lastOrderedAt,
         COALESCE(p.ProductName, 'Construction Material') as name,
         p.ProductCode as sku,
         p.ProductImage as imageUrl,
         p.CategoryID as categoryId,
         COALESCE(mu.UnitName, 'unit') as unit,
         (p.ID IS NOT NULL AND p.IsActive = 1) as active,
         ${VARIANT_SELLING_PRICE} as price,
         pv.ID as variantId,
         pv.VariantName as variantName,
         pv.IsActive as variantActive,
         COALESCE(pv.StockQuantity, 0) as stockQuantity,
         COALESCE(p.MinOrderQuantity, 1) as minOrderQuantity,
         COALESCE(p.QuantityStep, 1) as quantityStep
       FROM order_items oi
       JOIN orders o ON o.ID = oi.OrderID
       JOIN (
         SELECT MAX(oi2.ID) as lastItemId
         FROM order_items oi2
         JOIN orders o2 ON o2.ID = oi2.OrderID
         WHERE o2.UserID = ? AND o2.OrderStatus <> 'cancelled'
         GROUP BY oi2.ProductID
       ) pick ON pick.lastItemId = oi.ID
       LEFT JOIN products p ON p.ID = oi.ProductID
       LEFT JOIN product_variants pv ON pv.ID = oi.VariantID AND pv.ProductID = oi.ProductID
       LEFT JOIN measurement_units mu ON mu.ID = p.MeasurementUnitID
       ORDER BY o.ID DESC
       LIMIT ?`,
      [userId, limit]
    );

    return rows.map((row) =>
      orderAgainItem({
        productId: Number(row.productId),
        name: String(row.name || 'Construction Material'),
        sku: row.sku == null ? null : String(row.sku),
        imageUrl: row.imageUrl == null || row.imageUrl === '' ? null : String(row.imageUrl),
        categoryId: row.categoryId == null ? null : Number(row.categoryId),
        unit: String(row.unit || 'unit'),
        active: Number(row.active) === 1,
        price: row.price == null ? null : Number(row.price),
        variantId: row.variantId == null ? null : Number(row.variantId),
        variantName: row.variantName ? String(row.variantName) : null,
        variantLive: row.variantId != null && Number(row.variantActive) === 1,
        stockQuantity:
          row.variantId != null && Number(row.variantActive) === 1 ? Number(row.stockQuantity) || 0 : 0,
        minOrderQuantity: Number(row.minOrderQuantity) || 1,
        quantityStep: Number(row.quantityStep) || 1,
        lastQuantity: Number(row.lastQuantity) || 1,
        lastOrderedAt: String(row.lastOrderedAt),
      } satisfies OrderAgainSource)
    );
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
          o.OrderSource as source,
           CAST(o.GrandTotal AS DOUBLE) as total,
           CAST(o.SubTotal AS DOUBLE) as subtotal,
           CAST(o.TaxTotal AS DOUBLE) as taxTotal,
          CAST(o.ShippingCharges AS DOUBLE) as deliveryCharge,
          CAST(o.DiscountTotal AS DOUBLE) as discountTotal,
           o.ShippingAddress as deliveryAddress,
           o.StoreID as storeId,
           st.StoreName as storeName,
           COALESCE(NULLIF(u.full_name, ''), NULLIF(o.GuestName, '')) as customerName,
           COALESCE(u.phone, o.GuestPhone, '') as customerMobile,
           COALESCE(u.email, o.GuestEmail, '') as customerEmail
         FROM orders o
         LEFT JOIN homecare.users u ON o.UserID = u.user_id
         LEFT JOIN stores st ON st.ID = o.StoreID
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
             p.ProductCode as sku,
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
        order.customerName = givenName(order.customerName);

        const [history] = await storePool.query<any[]>(
          `SELECT ID as id, OrderStatus as status, PaymentStatus as paymentStatus, Notes as notes, CreatedDate as date, CreatedTime as time
           FROM order_status_history WHERE OrderID = ? ORDER BY ID ASC`,
          [order.id]
        );
        order.history = history;
        await OrderNoticeService.attach([order]);

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
            ? guestInfo?.name || ''
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
      name: guestInfo?.name || '',
      phone: guestInfo?.phone || '',
      email: guestInfo?.email || '',
    };
  }

  /**
   * The customer a staff order is attached to. An existing phone keeps that account.
   * A new 10-digit phone gets an unverified customer, the same as guest checkout.
   */
  static async customerForStaff(phone: string, name: string): Promise<number | undefined> {
    const clean = AuthService.cleanPhone(phone);
    const [existing] = await userPool.query<any[]>(`SELECT user_id FROM users WHERE phone = ? LIMIT 1`, [clean]);
    if (existing.length) return Number(existing[0].user_id);
    return OrderService.ownerForGuest({ name, phone: clean });
  }

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
      /** The store serving the delivery pincode. */
      storeId: number;
      userId?: number;
      customer: { name: string; phone: string; email: string };
      deliveryAddress: string;
      paymentMethod: string;
      notes: string;
      lines: CheckoutLine[];
      totals: CartTotals;
      /** The GST rate the cart totals were priced with. */
      taxRate?: number;
      /** Pending holds the stock for staff to confirm. Omitted means confirmed. */
      orderStatus?: 'pending' | 'confirmed';
      /** First history line. The customer's note stays on the order either way. */
      historyNote?: string;
      /** Who placed it. Omitted means the app. */
      source?: OrderSource;
      /** Staff member when they placed it. Otherwise the customer, or 1. */
      createdBy?: number;
    }
  ): Promise<number> {
    const orderNumber = `TX-ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const orderStatus = order.orderStatus ?? 'confirmed';
    const source = orderSource(order.source);
    const paymentStatus = 'pending';
    const { totals } = order;

    const [orderRes] = await conn.query<any>(
      `INSERT INTO orders
       (OrderNumber, UserID, CartID, StoreID, GuestName, GuestPhone, GuestEmail, ShippingAddress, SubTotal, TaxTotal, DiscountTotal, ShippingCharges, GrandTotal, OrderStatus, PaymentStatus, PaymentMethod, OrderSource, CreatedDate, CreatedTime, CreatedBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), CURTIME(), ?)`,
      [
        orderNumber,
        order.userId || null,
        order.cartId || null,
        order.storeId,
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
        source,
        order.createdBy ?? order.userId ?? 1,
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
          (line.lineTotal * (order.taxRate ?? TAX_RATE)).toFixed(2),
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
      if (order.storeId) {
        await conn.query(
          `UPDATE store_variant_stock
           SET StockQuantity = GREATEST(0, StockQuantity - ?)
           WHERE StoreID = ? AND VariantID = ?`,
          [line.quantity, order.storeId, line.variantId]
        );
      }
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
      [orderId, orderStatus, paymentStatus, order.historyNote ?? order.notes, order.userId || 1]
    );
    return orderId;
  }

  /** What the customer is shown for a placed order; the same body for a first answer and a repeat. */
  static async receipt(orderId: number, conn: Pick<PoolConnection, 'query'> = storePool) {
    const [rows] = await conn.query<any[]>(
      `SELECT o.ID as id, o.OrderNumber as orderNumber,
              UNIX_TIMESTAMP(TIMESTAMP(o.CreatedDate, COALESCE(o.CreatedTime, '00:00:00'))) as placedEpoch,
              o.OrderStatus as status, o.PaymentStatus as paymentStatus, o.PaymentMethod as paymentMethod,
              o.OrderSource as source,
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
      source: orderSource(o.source),
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
      awaitingStaff: o.status === 'pending',
      message:
        o.status === 'pending'
          ? 'This order is waiting for staff to confirm it. The goods are held until they confirm it or cancel it.'
          : null,
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
    const { storeId } = await DeliveryAreaService.assertServiceable(
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

      await StoreStockService.capLines(conn, storeId, rows);
      const { lines, totals, taxRate } = await CartService.priceRows(rows);
      for (const line of lines) {
        const refusal = quantityRefusal(line.name, line.quantity, line.limits, line.basePrice);
        if (refusal) throw orderRefusal(409, refusal);
      }

      const placement = checkoutPlacement({
        settings: await ShopSettingsService.read(),
        grandTotal: totals.grandTotal,
        lines,
        paymentMethod,
      });
      if (placement.refusal) throw orderRefusal(409, placement.refusal);

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
      const notes = payload.notes || 'Order placed directly via Buy Now';
      const orderId = await this.writeOrder(conn, {
        storeId,
        userId,
        customer,
        deliveryAddress: address.addressString,
        paymentMethod,
        notes,
        lines,
        totals,
        taxRate,
        orderStatus: placement.status,
        historyNote: placement.reason ?? notes,
        source: 'app',
      });
      await StaffAlertService.recordOrder(conn, orderId);
      await conn.commit();
      await OrderNoticeService.tell(orderId);
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

  /**
   * Changes the status on one transaction. Cancelling an order placed through this shop puts its stock back
   * on the variants it took from; cancelled is final, so that happens once.
   */
  static async updateOrderStatus(orderId: string | number, status: OrderStatus, note?: string, actorId: number = 1) {
    let conn: PoolConnection | undefined;
    try {
      conn = await storePool.getConnection();
      await conn.beginTransaction();
      const [orders] = await conn.query<any[]>(
        `SELECT ID, OrderNumber, OrderStatus FROM orders WHERE ID = ? OR OrderNumber = ? LIMIT 1 FOR UPDATE`,
        [orderId, orderId]
      );
      if (!orders.length) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
      const order = orders[0];
      const previous = String(order.OrderStatus);
      const refusal = statusChangeRefusal(previous, status);
      if (refusal) throw Object.assign(new Error(refusal), { statusCode: 409 });

      await conn.query(
        `UPDATE orders SET OrderStatus = ?, UpdatedDate = CURDATE(), UpdatedTime = CURTIME() WHERE ID = ?`,
        [status, order.ID]
      );
      const stockReturned =
        status === 'cancelled' && restocksOnCancel(order.OrderNumber)
          ? await OrderService.putStockBack(conn, Number(order.ID))
          : [];
      const defaultNote =
        status === 'cancelled'
          ? stockReturned.length
            ? 'Cancelled from the portal; stock put back'
            : 'Cancelled from the portal; imported order, no stock put back'
          : 'Status updated from admin operations portal';
      await conn.query(
        `INSERT INTO order_status_history
         (OrderID, OrderStatus, Notes, ChangedBy, CreatedDate, CreatedTime)
         VALUES (?, ?, ?, ?, CURDATE(), CURTIME())`,
        [order.ID, status, note || defaultNote, actorId]
      );
      await conn.commit();
      const confirmation =
        !orderAccepted(previous) && orderAccepted(status) ? await OrderNoticeService.tell(Number(order.ID)) : null;
      return { success: true, status, stockReturned, confirmation };
    } catch (err: any) {
      await conn?.rollback().catch(() => undefined);
      if (err?.statusCode) throw err;
      return mysqlOrFileStore('orders.updateOrderStatus', err, () => {
        const updated = store.updateOrderStatus(String(orderId), status as any);
        if (!updated) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
        return { success: true, status, stockReturned: [] };
      });
    } finally {
      conn?.release();
    }
  }

  /**
   * The reverse of the stock taken in `writeOrder`: each line's quantity goes back on its variant, the
   * variant's inventory rows are resized to add up to it again, and an out-of-stock product is back in stock.
   * A store that had its own quantity gets the same amount back on that row. A store with no row is unchanged.
   */
  private static async putStockBack(conn: PoolConnection, orderId: number) {
    const [orders] = await conn.query<any[]>(`SELECT StoreID as storeId FROM orders WHERE ID = ? LIMIT 1`, [orderId]);
    const storeId = Number(orders[0]?.storeId) || 0;
    const [lines] = await conn.query<any[]>(
      `SELECT ProductID as productId, VariantID as variantId, Quantity as quantity FROM order_items WHERE OrderID = ?`,
      [orderId]
    );
    const returned: { productId: number; variantId: number; quantity: number }[] = [];
    for (const line of lines) {
      const quantity = Math.max(0, Math.floor(Number(line.quantity) || 0));
      if (!quantity) continue;
      const variantId = Number(line.variantId);
      const productId = Number(line.productId);
      const [variants] = await conn.query<any[]>(
        `SELECT StockQuantity as stock FROM product_variants WHERE ID = ? FOR UPDATE`,
        [variantId]
      );
      if (!variants.length) continue;
      const stock = Math.max(0, Number(variants[0].stock) || 0) + quantity;
      await conn.query(
        `UPDATE product_variants SET StockQuantity = ?, UpdatedDate = CURDATE(), UpdatedTime = CURTIME() WHERE ID = ?`,
        [stock, variantId]
      );
      const [rows] = await conn.query<any[]>(
        `SELECT ID as id, StockQuantity as quantity FROM inventory_stock WHERE VariantID = ? ORDER BY ID ASC FOR UPDATE`,
        [variantId]
      );
      for (const row of allocateCatalogueStock(rows, stock)) {
        await conn.query(
          `UPDATE inventory_stock SET StockQuantity = ?, UpdatedDate = CURDATE(), UpdatedTime = CURTIME() WHERE ID = ?`,
          [row.quantity, row.id]
        );
      }
      if (storeId) {
        await conn.query(
          `UPDATE store_variant_stock SET StockQuantity = StockQuantity + ? WHERE StoreID = ? AND VariantID = ?`,
          [quantity, storeId, variantId]
        );
      }
      await conn.query(
        `UPDATE products SET StockStatus = 'in_stock', UpdatedDate = CURDATE(), UpdatedTime = CURTIME()
         WHERE ID = ? AND StockStatus = 'out_of_stock'`,
        [productId]
      );
      returned.push({ productId, variantId, quantity });
    }
    return returned;
  }

  static async getOrderStats(storeIds: number[] | null = null) {
    try {
      const params: any[] = [];
      const filter = storeClause(storeIds, params);
      const [rows] = await storePool.query<any[]>(
        `SELECT 
           COUNT(*) as totalOrders,
           COALESCE(SUM(o.GrandTotal), 0) as totalRevenue,
           SUM(CASE WHEN o.OrderStatus = 'pending' THEN 1 ELSE 0 END) as pendingCount,
           SUM(CASE WHEN o.OrderStatus = 'processing' THEN 1 ELSE 0 END) as processingCount,
           SUM(CASE WHEN o.OrderStatus = 'shipped' THEN 1 ELSE 0 END) as shippedCount,
           SUM(CASE WHEN o.OrderStatus = 'delivered' THEN 1 ELSE 0 END) as deliveredCount,
           SUM(CASE WHEN o.OrderStatus = 'cancelled' THEN 1 ELSE 0 END) as cancelledCount
         FROM orders o WHERE 1 = 1${filter}`,
        params
      );
      return rows[0];
    } catch (err) {
      return { totalOrders: 0, totalRevenue: 0, pendingCount: 0, processingCount: 0, shippedCount: 0, deliveredCount: 0 };
    }
  }
}
