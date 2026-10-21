import { Router } from 'express';
import { OrderService } from '../services/orderService.js';
import { asyncHandler, sendSuccess, sendError } from '../utils/response.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

// GET /orders - List orders
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const isPortal = req.query.all === 'true' || req.headers['x-client'] === 'portal';
    const { status, search, page, limit } = req.query;

    const result = await OrderService.getOrders({
      userId: req.user?.userId,
      status: status ? String(status) : undefined,
      search: search ? String(search) : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      isPortal,
    });

    return sendSuccess(res, result.orders, undefined, 200, result.meta);
  })
);

// GET /orders/stats - Order fulfillment metrics
router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const stats = await OrderService.getOrderStats();
    return sendSuccess(res, stats);
  })
);

// GET /orders/:id - Single order details
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const order = await OrderService.getOrderById(req.params.id);
    if (!order) return sendError(res, 404, 'Order not found');
    return sendSuccess(res, order);
  })
);

// POST /orders - Create order
router.post(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const newOrder = await OrderService.createOrder(req.body, req.user?.userId);
    return sendSuccess(res, newOrder, 'Order placed successfully', 201);
  })
);

// PUT /orders/:id/status - Update order status
router.put(
  '/:id/status',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { status, note } = req.body;
    if (!status) return sendError(res, 400, 'Status is required');

    const result = await OrderService.updateOrderStatus(
      req.params.id,
      status,
      note,
      req.user?.adminId || 1
    );
    return sendSuccess(res, result, 'Order status updated');
  })
);

export default router;
