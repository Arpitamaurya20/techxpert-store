import { Router } from 'express';
import { OrderService } from '../services/orderService.js';
import { asyncHandler, sendSuccess, sendError } from '../utils/response.js';
import {
  optionalAuth,
  requireAdmin,
  requireAuth,
  requirePermission,
  resolveAdmin,
  permissionRefusal,
} from '../middleware/auth.js';
import { can } from '../utils/permissions.js';
import { validateOrderStatusBody } from '../utils/validate.js';
import { coversStore, storeFilter, type Scope } from '../utils/scope.js';

const router = Router();

/** Staff see an order only when its store is inside their places. */
function orderInScope(order: { storeId?: unknown }, scope: Scope): boolean {
  if (scope.all) return true;
  return order.storeId != null && coversStore(scope, Number(order.storeId));
}

// GET /orders - List orders (customer: own orders; portal all=true needs orders view)
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const wantsAll = req.query.all === 'true' || req.headers['x-client'] === 'portal';
    let storeIds: number[] | null = null;
    if (wantsAll) {
      const admin = await resolveAdmin(req);
      if (!can(admin.access.permissions, 'orders', 'view')) {
        return sendError(res, 403, permissionRefusal('orders', 'view'));
      }
      storeIds = storeFilter(admin.access.scope);
    } else if (!req.user?.userId) {
      return sendError(res, 401, 'Sign in to see your orders.');
    }

    const result = await OrderService.getOrders({
      userId: wantsAll ? undefined : req.user?.userId,
      status: req.query.status ? String(req.query.status) : undefined,
      search: req.query.search ? String(req.query.search) : undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      isPortal: wantsAll,
      storeIds,
    });

    return sendSuccess(res, result.orders, undefined, 200, result.meta);
  })
);

// GET /orders/again - Products this customer bought, at today's price and stock
router.get(
  '/again',
  optionalAuth,
  asyncHandler(async (req, res) => {
    if (!req.user?.userId) return sendError(res, 401, 'Sign in to see your orders.');
    const items = await OrderService.getOrderAgain(req.user.userId, req.query.limit);
    return sendSuccess(res, items);
  })
);

// GET /orders/stats - Order fulfillment metrics (staff with orders view)
router.get(
  '/stats',
  requireAdmin,
  requirePermission('orders', 'view'),
  asyncHandler(async (req, res) => {
    const stats = await OrderService.getOrderStats(storeFilter(req.user!.access!.scope));
    return sendSuccess(res, stats);
  })
);

// GET /orders/:id - Owner, or staff with orders view
router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    let scope: Scope | null = null;
    if (req.user?.staffId) {
      const admin = await resolveAdmin(req);
      if (!can(admin.access.permissions, 'orders', 'view')) {
        return sendError(res, 403, permissionRefusal('orders', 'view'));
      }
      scope = admin.access.scope;
    }

    const order = await OrderService.getOrderById(req.params.id);
    if (!order) return sendError(res, 404, 'Order not found');
    if (scope && !orderInScope(order, scope)) return sendError(res, 404, 'Order not found');

    const isAdmin = Boolean(req.user?.staffId);
    const ownerId = order.userId != null ? Number(order.userId) : null;
    const isOwner =
      req.user?.userId != null && ownerId != null && Number(req.user.userId) === ownerId;

    if (!isAdmin && !isOwner) {
      return sendError(res, 403, 'Not allowed to view this order');
    }

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

// PUT /orders/:id/status - Update order status (staff with orders edit)
router.put(
  '/:id/status',
  requireAdmin,
  requirePermission('orders', 'edit'),
  asyncHandler(async (req, res) => {
    const { status, note } = validateOrderStatusBody(req.body);
    const order = await OrderService.getOrderById(req.params.id);
    if (!order || !orderInScope(order, req.user!.access!.scope)) return sendError(res, 404, 'Order not found');

    const result = await OrderService.updateOrderStatus(
      req.params.id,
      status,
      note,
      req.user!.staffId!
    );
    return sendSuccess(res, result, 'Order status updated');
  })
);

export default router;
