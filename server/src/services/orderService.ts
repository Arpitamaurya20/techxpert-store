import { storePool, userPool } from '../db/mysql.js';
import { store } from '../db/store.js';
import { PricingService } from './pricingService.js';

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

    return {
      addressString: fallbackAddress || 'Sector 62, Noida, Uttar Pradesh 201309 (Default)',
    };
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
          return {
            name: u.full_name || guestInfo?.name || 'Customer',
            phone: u.phone || guestInfo?.phone || '',
            email: u.email || guestInfo?.email || '',
          };
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

  static async checkout(payload: {
    userId?: number;
    cartId?: number;
    items?: Array<{ productId: number; variantId?: number; quantity: number; unitPrice?: number }>;
    addressId?: number;
    shippingAddress?: string;
    paymentMethod?: string;
    notes?: string;
    guestName?: string;
    guestPhone?: string;
    guestEmail?: string;
  }) {
    const { userId, cartId, addressId, shippingAddress, paymentMethod = 'COD', notes } = payload;

    // 1. Gather order items (from cart or direct payload)
    let rawItems = payload.items;
    if (cartId && (!rawItems || rawItems.length === 0)) {
      const [cartItems] = await storePool.query<any[]>(
        `SELECT ci.VariantID as variantId, ci.Quantity as quantity, pv.ProductID as productId
         FROM techxpertstore.cart_items ci
         LEFT JOIN techxpertstore.product_variants pv ON pv.ID = ci.VariantID
         WHERE ci.CartID = ?`,
        [cartId]
      );
      if (cartItems.length === 0) {
        throw new Error('Cart is empty. Add items to checkout.');
      }
      rawItems = cartItems.map((ci) => ({
        variantId: ci.variantId,
        productId: ci.productId,
        quantity: ci.quantity,
      }));
    }

    if (!rawItems || rawItems.length === 0) {
      throw new Error('Order must contain at least one item');
    }

    // 2. Resolve customer info and address from homecare
    const customer = await this.resolveCustomerInfo(userId, {
      name: payload.guestName,
      phone: payload.guestPhone,
      email: payload.guestEmail,
    });
    const address = await this.resolveDeliveryAddress(userId, addressId, shippingAddress);

    // 3. Connect to DB and start atomic transaction
    const conn = await storePool.getConnection();
    try {
      await conn.beginTransaction();

      const processedItems: any[] = [];
      let subtotal = 0;
      let totalBulkSavings = 0;

      for (const item of rawItems) {
        const qty = Math.max(Number(item.quantity) || 1, 1);
        let variantId = item.variantId ? Number(item.variantId) : null;
        let productId = item.productId ? Number(item.productId) : null;

        // If variantId not provided, look up primary variant for product
        if (!variantId && productId) {
          const [vars] = await conn.query<any[]>(
            `SELECT ID FROM techxpertstore.product_variants WHERE ProductID = ? ORDER BY ID ASC LIMIT 1`,
            [productId]
          );
          if (vars.length > 0) {
            variantId = vars[0].ID;
          }
        }

        // Lock variant row with FOR UPDATE
        let variantRow: any = null;
        if (variantId) {
          const [vars] = await conn.query<any[]>(
            `SELECT 
               pv.ID as variantId,
               pv.ProductID as productId,
               pv.StockQuantity as stockQuantity,
               pv.VariantName as variantName,
               p.ProductName as productName,
               p.ProductCode as sku,
               p.CategoryID as categoryId,
               COALESCE(pr.SellingPrice, 450) as basePrice,
               COALESCE(mu.UnitName, 'unit') as unit
             FROM techxpertstore.product_variants pv
             LEFT JOIN techxpertstore.products p ON p.ID = pv.ProductID
             LEFT JOIN techxpertstore.product_pricing pr ON pr.ProductID = p.ID AND pr.IsActive = 1
             LEFT JOIN techxpertstore.measurement_units mu ON p.MeasurementUnitID = mu.ID
             WHERE pv.ID = ?
             FOR UPDATE`,
            [variantId]
          );
          if (vars.length > 0) {
            variantRow = vars[0];
            productId = variantRow.productId;
          }
        }

        if (!variantRow && productId) {
          const [prods] = await conn.query<any[]>(
            `SELECT 
               p.ID as productId,
               p.ProductName as productName,
               p.ProductCode as sku,
               p.CategoryID as categoryId,
               COALESCE(pr.SellingPrice, 450) as basePrice,
               COALESCE(mu.UnitName, 'unit') as unit
             FROM techxpertstore.products p
             LEFT JOIN techxpertstore.product_pricing pr ON pr.ProductID = p.ID AND pr.IsActive = 1
             LEFT JOIN techxpertstore.measurement_units mu ON p.MeasurementUnitID = mu.ID
             WHERE p.ID = ?
             FOR UPDATE`,
            [productId]
          );
          if (prods.length > 0) {
            variantRow = {
              ...prods[0],
              variantId: null,
              stockQuantity: 999,
            };
          }
        }

        if (!variantRow) {
          throw new Error(`Product or variant not found for item ${JSON.stringify(item)}`);
        }

        // Check stock availability
        const currentStock = Number(variantRow.stockQuantity) || 0;
        if (variantId && currentStock < qty) {
          throw new Error(
            `Insufficient stock for "${variantRow.productName}". Requested: ${qty}, Available: ${currentStock}`
          );
        }

        // Calculate pricing and bulk discount
        const basePrice = item.unitPrice ? Number(item.unitPrice) : Number(variantRow.basePrice);
        const pricing = await PricingService.calculateBulkPrice(productId!, qty, basePrice);

        const unitPrice = pricing.unitPrice;
        const discountAmount = pricing.totalSavings;
        const lineTotal = unitPrice * qty;

        subtotal += lineTotal;
        totalBulkSavings += discountAmount;

        // Atomic inventory decrement
        if (variantId) {
          await conn.query(
            `UPDATE techxpertstore.product_variants 
             SET StockQuantity = GREATEST(0, StockQuantity - ?), UpdatedDate = CURDATE(), UpdatedTime = CURTIME() 
             WHERE ID = ?`,
            [qty, variantId]
          );

          await conn.query(
            `UPDATE techxpertstore.inventory_stock 
             SET StockQuantity = GREATEST(0, StockQuantity - ?), LastStockOutDate = CURDATE(), UpdatedDate = CURDATE(), UpdatedTime = CURTIME() 
             WHERE VariantID = ?`,
            [qty, variantId]
          );

          // If variant stock hits 0, check if all variants are out of stock
          if (currentStock - qty <= 0) {
            await conn.query(
              `UPDATE techxpertstore.products 
               SET StockStatus = 'out_of_stock', UpdatedDate = CURDATE(), UpdatedTime = CURTIME() 
               WHERE ID = ? AND (SELECT COALESCE(SUM(StockQuantity), 0) FROM techxpertstore.product_variants WHERE ProductID = ?) <= 0`,
              [productId, productId]
            );
          }
        }

        processedItems.push({
          productId,
          variantId,
          name: variantRow.productName,
          sku: variantRow.sku,
          unit: variantRow.unit,
          quantity: qty,
          basePrice,
          unitPrice,
          discountAmount,
          taxAmount: Number((lineTotal * 0.18).toFixed(2)),
          lineTotal,
          appliedTier: pricing.appliedTier,
        });
      }

      // 4. Financial Calculations
      const taxTotal = Number((subtotal * 0.18).toFixed(2));
      const shippingCharges = subtotal >= 2000 ? 0 : 99;
      const grandTotal = Number((subtotal + taxTotal + shippingCharges).toFixed(2));

      // 5. Insert into orders table
      const orderNumber = `TX-ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
      const orderStatus = 'confirmed';
      const paymentStatus = paymentMethod.toUpperCase() === 'COD' ? 'pending' : 'paid';

      const [orderRes] = await conn.query<any>(
        `INSERT INTO techxpertstore.orders 
         (OrderNumber, UserID, GuestName, GuestPhone, GuestEmail, ShippingAddress, SubTotal, TaxTotal, DiscountTotal, ShippingCharges, GrandTotal, OrderStatus, PaymentStatus, PaymentMethod, CreatedDate, CreatedTime, CreatedBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), CURTIME(), ?)`,
        [
          orderNumber,
          userId || null,
          customer.name,
          customer.phone,
          customer.email,
          address.addressString,
          subtotal.toFixed(2),
          taxTotal.toFixed(2),
          totalBulkSavings.toFixed(2),
          shippingCharges.toFixed(2),
          grandTotal.toFixed(2),
          orderStatus,
          paymentStatus,
          paymentMethod,
          userId || 1,
        ]
      );

      const orderId = orderRes.insertId;

      // 6. Insert line items
      for (const it of processedItems) {
        await conn.query(
          `INSERT INTO techxpertstore.order_items 
           (OrderID, VariantID, ProductID, Quantity, UnitPrice, TaxRate, TaxAmount, DiscountAmount, LineTotal, CreatedDate, CreatedTime)
           VALUES (?, ?, ?, ?, ?, 18.00, ?, ?, ?, CURDATE(), CURTIME())`,
          [
            orderId,
            it.variantId || it.productId,
            it.productId,
            it.quantity,
            it.unitPrice.toFixed(2),
            it.taxAmount.toFixed(2),
            it.discountAmount.toFixed(2),
            it.lineTotal.toFixed(2),
          ]
        );
      }

      // 7. Insert status history
      await conn.query(
        `INSERT INTO techxpertstore.order_status_history 
         (OrderID, OrderStatus, PaymentStatus, Notes, ChangedBy, CreatedDate, CreatedTime)
         VALUES (?, ?, ?, ?, ?, CURDATE(), CURTIME())`,
        [
          orderId,
          orderStatus,
          paymentStatus,
          notes || (cartId ? 'Order placed via Cart Checkout' : 'Order placed directly via Buy Now'),
          userId || 1,
        ]
      );

      // 8. If checkout was from cart, clean up cart
      if (cartId) {
        await conn.query(`DELETE FROM techxpertstore.cart_items WHERE CartID = ?`, [cartId]);
        await conn.query(
          `UPDATE techxpertstore.carts SET Status = 'merged', UpdatedDate = CURDATE(), UpdatedTime = CURTIME() WHERE ID = ?`,
          [cartId]
        );
      }

      // 9. Commit transaction!
      await conn.commit();

      return {
        id: String(orderId),
        orderNumber,
        placedAt: new Date().toISOString(),
        status: orderStatus,
        paymentStatus,
        paymentMethod,
        customerName: customer.name,
        customerMobile: customer.phone,
        deliveryAddress: address.addressString,
        subtotal,
        discountTotal: totalBulkSavings,
        taxTotal,
        shippingCharges,
        grandTotal,
        total: grandTotal,
        items: processedItems,
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  static async createOrder(orderData: any, userId?: number) {
    try {
      return await this.checkout({
        ...orderData,
        userId: userId || orderData.userId,
      });
    } catch (err: any) {
      console.warn('[OrderService] MySQL checkout failed, fallback to local store:', err.message);
      if (err.message?.includes('Insufficient stock') || err.message?.includes('empty')) {
        throw err;
      }
    }

    const calculatedTotal = orderData.total || 450;
    return store.createOrder({
      id: `ord-${Date.now()}`,
      orderNumber: `ORD-${Date.now().toString().slice(-6)}`,
      placedAt: new Date().toISOString(),
      status: 'placed',
      items: orderData.items || [],
      total: calculatedTotal,
      deliveryAddress: orderData.deliveryAddress || 'Sector 62, Noida, Uttar Pradesh',
      customerName: orderData.customerName || 'Valued Customer',
      customerMobile: orderData.customerMobile || '9876543210',
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
