import { storePool } from '../db/mysql.js';
import { store } from '../db/store.js';

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

      const countSql = `
        SELECT COUNT(*) as total 
        FROM techxpertstore.orders o 
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
        FROM techxpertstore.orders o
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
           FROM techxpertstore.order_items oi
           LEFT JOIN techxpertstore.products p ON oi.ProductID = p.ID
           LEFT JOIN techxpertstore.measurement_units mu ON p.MeasurementUnitID = mu.ID
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
      console.warn('[OrderService] MySQL getOrders failed, fallback', err);
      const fallback = store.getOrders(params.isPortal ? undefined : (params.userId ? String(params.userId) : undefined));
      return {
        orders: fallback,
        meta: { page: 1, limit, total: fallback.length, totalPages: 1 },
      };
    }
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
         FROM techxpertstore.orders o
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
           FROM techxpertstore.order_items oi
           LEFT JOIN techxpertstore.products p ON oi.ProductID = p.ID
           LEFT JOIN techxpertstore.measurement_units mu ON p.MeasurementUnitID = mu.ID
           WHERE oi.OrderID = ?`,
          [order.id]
        );
        order.items = items;

        const [history] = await storePool.query<any[]>(
          `SELECT ID as id, OrderStatus as status, PaymentStatus as paymentStatus, Notes as notes, CreatedDate as date, CreatedTime as time
           FROM techxpertstore.order_status_history WHERE OrderID = ? ORDER BY ID ASC`,
          [order.id]
        );
        order.history = history;

        return order;
      }
    } catch (err) {
      console.warn('[OrderService] getOrderById MySQL failed, fallback', err);
    }

    return store.getOrders().find((o) => o.id === String(orderId) || o.orderNumber === String(orderId));
  }

  static async createOrder(orderData: any, userId?: number) {
    const { items, total, deliveryAddress, customerName, customerMobile, paymentMethod = 'COD' } = orderData;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Order must contain at least one item');
    }

    const orderNumber = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const calculatedTotal =
      total !== undefined
        ? Number(total)
        : items.reduce((acc: number, item: any) => acc + (item.unitPrice || 0) * (item.quantity || 1), 0);

    const subTotal = (calculatedTotal * 0.82).toFixed(2);
    const taxTotal = (calculatedTotal * 0.18).toFixed(2);
    const resolvedUserId = userId || 1;

    try {
      const [orderRes] = await storePool.query<any>(
        `INSERT INTO techxpertstore.orders 
         (OrderNumber, UserID, ShippingAddress, SubTotal, TaxTotal, GrandTotal, OrderStatus, PaymentStatus, PaymentMethod, CreatedDate, CreatedTime, CreatedBy)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', 'pending', ?, CURDATE(), CURTIME(), ?)`,
        [
          orderNumber,
          resolvedUserId,
          deliveryAddress || 'Sector 62, Noida, Uttar Pradesh',
          subTotal,
          taxTotal,
          calculatedTotal,
          paymentMethod,
          resolvedUserId,
        ]
      );

      const newOrderId = orderRes.insertId;

      for (const it of items) {
        const prodId = Number(it.productId) || 1;
        const variantId = Number(it.variantId) || prodId;
        const qty = Number(it.quantity) || 1;
        const unitPrice = Number(it.unitPrice) || 450;
        const lineTotal = unitPrice * qty;

        await storePool.query(
          `INSERT INTO techxpertstore.order_items 
           (OrderID, VariantID, ProductID, Quantity, UnitPrice, TaxRate, TaxAmount, LineTotal, CreatedDate, CreatedTime)
           VALUES (?, ?, ?, ?, ?, 18.00, ?, ?, CURDATE(), CURTIME())`,
          [
            newOrderId,
            variantId,
            prodId,
            qty,
            unitPrice,
            (lineTotal * 0.18).toFixed(2),
            lineTotal.toFixed(2),
          ]
        );
      }

      await storePool.query(
        `INSERT INTO techxpertstore.order_status_history 
         (OrderID, OrderStatus, PaymentStatus, Notes, ChangedBy, CreatedDate, CreatedTime)
         VALUES (?, 'pending', 'pending', 'Order placed by customer', ?, CURDATE(), CURTIME())`,
        [newOrderId, resolvedUserId]
      );

      return {
        id: String(newOrderId),
        orderNumber,
        placedAt: new Date().toISOString(),
        status: 'pending',
        items,
        total: calculatedTotal,
      };
    } catch (err) {
      console.warn('[OrderService] MySQL insert failed, fallback to local store', err);
    }

    return store.createOrder({
      id: `ord-${Date.now()}`,
      orderNumber,
      placedAt: new Date().toISOString(),
      status: 'placed',
      items,
      total: calculatedTotal,
      deliveryAddress: deliveryAddress || 'Sector 62, Noida, Uttar Pradesh',
      customerName: customerName || 'Valued Customer',
      customerMobile: customerMobile || '9876543210',
    });
  }

  static async updateOrderStatus(orderId: string | number, status: string, note?: string, actorId: number = 1) {
    try {
      await storePool.query(
        `UPDATE techxpertstore.orders 
         SET OrderStatus = ?, UpdatedDate = CURDATE(), UpdatedTime = CURTIME()
         WHERE ID = ? OR OrderNumber = ?`,
        [status, orderId, orderId]
      );

      const [orders] = await storePool.query<any[]>(
        `SELECT ID FROM techxpertstore.orders WHERE ID = ? OR OrderNumber = ? LIMIT 1`,
        [orderId, orderId]
      );

      if (orders.length > 0) {
        await storePool.query(
          `INSERT INTO techxpertstore.order_status_history
           (OrderID, OrderStatus, Notes, ChangedBy, CreatedDate, CreatedTime)
           VALUES (?, ?, ?, ?, CURDATE(), CURTIME())`,
          [orders[0].ID, status, note || 'Status updated from admin operations portal', actorId]
        );
      }

      return { success: true, status };
    } catch (err) {
      console.warn('[OrderService] MySQL update status failed, fallback', err);
    }

    const updated = store.updateOrderStatus(String(orderId), status as any);
    if (!updated) throw new Error('Order not found');
    return { success: true, status };
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
         FROM techxpertstore.orders`
      );
      return rows[0];
    } catch (err) {
      return { totalOrders: 0, totalRevenue: 0, pendingCount: 0, processingCount: 0, shippedCount: 0, deliveredCount: 0 };
    }
  }
}
