import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { storePool } from '../db/mysql.js';
import { store } from '../db/store.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'techxpert-store-secret-key-2026';

function extractUserId(req: Request): number | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET) as any;
    return Number(payload.userId || payload.id) || null;
  } catch {
    return null;
  }
}

// GET /orders
router.get('/', async (req: Request, res: Response) => {
  const userId = extractUserId(req);
  const isPortal = req.query.all === 'true' || req.headers['x-client'] === 'portal';

  try {
    let orderQuery = `
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
    `;
    const params: any[] = [];

    if (!isPortal && userId) {
      orderQuery += ` WHERE o.UserID = ?`;
      params.push(userId);
    }

    orderQuery += ` ORDER BY o.ID DESC LIMIT 50`;

    const [orders] = await storePool.query<any[]>(orderQuery, params);

    // Fetch line items for each order
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

    if (orders.length > 0) {
      return res.json({ data: orders });
    }
  } catch (err) {
    console.warn('[Orders] MySQL query failed, falling back to local store', err);
  }

  return res.json({ data: store.getOrders(isPortal ? undefined : (userId ? String(userId) : undefined)) });
});

// POST /orders
router.post('/', async (req: Request, res: Response) => {
  const userId = extractUserId(req) || 1;
  const { items, total, deliveryAddress, customerName, customerMobile, paymentMethod = 'COD' } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order must contain at least one item' });
  }

  const orderNumber = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
  const calculatedTotal =
    total !== undefined
      ? Number(total)
      : items.reduce((acc: number, item: any) => acc + (item.unitPrice || 0) * (item.quantity || 1), 0);

  const subTotal = (calculatedTotal * 0.82).toFixed(2);
  const taxTotal = (calculatedTotal * 0.18).toFixed(2);

  try {
    const [orderRes] = await storePool.query<any>(
      `INSERT INTO techxpertstore.orders 
       (OrderNumber, UserID, ShippingAddress, SubTotal, TaxTotal, GrandTotal, OrderStatus, PaymentStatus, PaymentMethod, CreatedDate, CreatedTime, CreatedBy)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', 'pending', ?, CURDATE(), CURTIME(), ?)`,
      [
        orderNumber,
        userId,
        deliveryAddress || 'Sector 62, Noida, Uttar Pradesh',
        subTotal,
        taxTotal,
        calculatedTotal,
        paymentMethod,
        userId,
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

    // Insert order status history
    await storePool.query(
      `INSERT INTO techxpertstore.order_status_history 
       (OrderID, OrderStatus, PaymentStatus, Notes, ChangedBy, CreatedDate, CreatedTime)
       VALUES (?, 'pending', 'pending', 'Order placed by customer', ?, CURDATE(), CURTIME())`,
      [newOrderId, userId]
    );

    return res.status(201).json({
      data: {
        id: String(newOrderId),
        orderNumber,
        placedAt: new Date().toISOString(),
        status: 'pending',
        items,
        total: calculatedTotal,
      },
    });
  } catch (err) {
    console.warn('[Orders] MySQL insert failed, fallback to local store', err);
  }

  const localOrder = store.createOrder({
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

  return res.status(201).json({ data: localOrder });
});

// PUT /orders/:id/status
router.put('/:id/status', async (req: Request, res: Response) => {
  const { status, note } = req.body;
  if (!status) return res.status(400).json({ error: 'Status is required' });

  const orderIdOrNum = req.params.id;

  try {
    const [result] = await storePool.query<any>(
      `UPDATE techxpertstore.orders 
       SET OrderStatus = ?, UpdatedDate = CURDATE(), UpdatedTime = CURTIME()
       WHERE ID = ? OR OrderNumber = ?`,
      [status, orderIdOrNum, orderIdOrNum]
    );

    // Also update history if found
    const [orders] = await storePool.query<any[]>(
      `SELECT ID, OrderStatus FROM techxpertstore.orders WHERE ID = ? OR OrderNumber = ? LIMIT 1`,
      [orderIdOrNum, orderIdOrNum]
    );

    if (orders.length > 0) {
      await storePool.query(
        `INSERT INTO techxpertstore.order_status_history
         (OrderID, OrderStatus, Notes, ChangedBy, CreatedDate, CreatedTime)
         VALUES (?, ?, ?, 1, CURDATE(), CURTIME())`,
        [orders[0].ID, status, note || 'Status updated from admin operations portal']
      );
    }

    return res.json({ success: true, status });
  } catch (err) {
    console.warn('[Orders] MySQL update status failed, updating local store', err);
  }

  const updated = store.updateOrderStatus(orderIdOrNum, status);
  if (!updated) return res.status(404).json({ error: 'Order not found' });
  return res.json({ data: updated });
});

export default router;
