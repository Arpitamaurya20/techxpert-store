import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { store } from '../db/store.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'techxpert-store-secret-key-2026';

// GET /orders
router.get('/', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  let userId: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
      userId = payload.userId;
    } catch {
      // Allow fetching with fallback or error depending on mode
    }
  }

  // If called from portal or with query param ?all=true, return all orders
  const isPortal = req.query.all === 'true' || req.headers['x-client'] === 'portal';
  const orders = store.getOrders(isPortal ? undefined : userId);

  res.json({ data: orders });
});

// POST /orders
router.post('/', (req: Request, res: Response) => {
  const { items, total, deliveryAddress, customerName, customerMobile } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order must contain at least one item' });
  }

  const authHeader = req.headers.authorization;
  let userId: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
      userId = payload.userId;
    } catch {
      // Guest or unverified
    }
  }

  const calculatedTotal =
    total !== undefined
      ? Number(total)
      : items.reduce((acc: number, item: any) => acc + (item.unitPrice || 0) * (item.quantity || 1), 0);

  const orderNumber = `TX-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const newOrder = store.createOrder({
    id: `ord-${Date.now()}`,
    orderNumber,
    userId,
    placedAt: new Date().toISOString(),
    status: 'placed',
    items,
    total: calculatedTotal,
    deliveryAddress: deliveryAddress || 'Sector 62, Noida, Uttar Pradesh',
    customerName: customerName || 'Valued Customer',
    customerMobile: customerMobile || '9876543210',
  });

  res.status(201).json({ data: newOrder });
});

// PUT /orders/:id/status (Portal / Admin)
router.put('/:id/status', (req: Request, res: Response) => {
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  const updated = store.updateOrderStatus(req.params.id, status);
  if (!updated) {
    return res.status(404).json({ error: 'Order not found' });
  }

  res.json({ data: updated });
});

export default router;
