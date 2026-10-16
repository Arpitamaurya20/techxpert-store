import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { commercePool } from '../db/mysql.js';
import { store } from '../db/store.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'techxpert-store-secret-key-2026';

// GET /orders
router.get('/', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  let userId: number | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string | number };
      userId = Number(payload.userId);
    } catch {
      // Guest
    }
  }

  const isPortal = req.query.all === 'true' || req.headers['x-client'] === 'portal';

  try {
    let orderQuery = `
      SELECT id, order_number as orderNumber, placed_at as placedAt,
             order_status as status, total_amount as total,
             delivery_address as deliveryAddress, customer_name as customerName,
             customer_mobile as customerMobile
      FROM orders
    `;
    const params: any[] = [];

    if (!isPortal && userId) {
      orderQuery += ` WHERE user_id = ?`;
      params.push(userId);
    }

    orderQuery += ` ORDER BY placed_at DESC LIMIT 50`;

    const [orders] = await commercePool.query<any[]>(orderQuery, params);

    // Fetch line items for each order
    for (const order of orders) {
      const [items] = await commercePool.query<any[]>(
        `SELECT product_id as productId, product_name as name, quantity,
                unit_price as unitPrice, unit
         FROM order_items
         WHERE order_id = ?`,
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

  return res.json({ data: store.getOrders(isPortal ? undefined : String(userId)) });
});

// POST /orders
router.post('/', async (req: Request, res: Response) => {
  const { items, total, deliveryAddress, customerName, customerMobile } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order must contain at least one item' });
  }

  const orderNumber = `TX-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const calculatedTotal =
    total !== undefined
      ? Number(total)
      : items.reduce((acc: number, item: any) => acc + (item.unitPrice || 0) * (item.quantity || 1), 0);

  try {
    const [orderRes] = await commercePool.query<any>(
      `INSERT INTO orders (order_number, total_amount, subtotal, delivery_address, customer_name, customer_mobile)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        orderNumber,
        calculatedTotal,
        calculatedTotal,
        deliveryAddress || 'Sector 62, Noida, Uttar Pradesh',
        customerName || 'Contractor Customer',
        customerMobile || '9876543210',
      ]
    );

    const newOrderId = orderRes.insertId;

    for (const it of items) {
      await commercePool.query(
        `INSERT INTO order_items (order_id, product_id, product_name, sku, unit, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newOrderId,
          Number(it.productId) || 1,
          it.name,
          it.sku || 'TX-SKU',
          it.unit || '50 kg bag',
          it.quantity,
          it.unitPrice || 450,
          (it.unitPrice || 450) * it.quantity,
        ]
      );
    }

    return res.status(201).json({
      data: {
        id: String(newOrderId),
        orderNumber,
        placedAt: new Date().toISOString(),
        status: 'placed',
        items,
        total: calculatedTotal,
      },
    });
  } catch (err) {
    console.warn('[Orders] MySQL insert failed, using local store', err);
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
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'Status is required' });

  try {
    await commercePool.query(
      `UPDATE orders SET order_status = ? WHERE id = ? OR order_number = ?`,
      [status, req.params.id, req.params.id]
    );

    await commercePool.query(
      `INSERT INTO order_status_history (order_id, to_status, note, changed_by)
       VALUES (?, ?, 'Status updated from admin portal', 'Arpit Maurya')`,
      [Number(req.params.id) || 1, status]
    );

    return res.json({ success: true, status });
  } catch (err) {
    console.warn('[Orders] MySQL update status failed, updating local store', err);
  }

  const updated = store.updateOrderStatus(req.params.id, status);
  if (!updated) return res.status(404).json({ error: 'Order not found' });
  return res.json({ data: updated });
});

export default router;
