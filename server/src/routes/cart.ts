import { Router, type Request } from 'express';
import { CartService, type CartAccess } from '../services/cartService.js';
import { CartCheckoutService } from '../services/cartCheckoutService.js';
import { asyncHandler, sendSuccess, sendError } from '../utils/response.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';

const router = Router();

function sessionIdFrom(req: Request) {
  return (
    (req.headers['x-session-id'] as string) ||
    (req.query.sessionId as string) ||
    (req.body?.sessionId as string) ||
    undefined
  );
}

/** Signed-in customers use their account cart; everyone else the guest session cart. */
function accessFrom(req: Request): CartAccess {
  return req.user?.userId ? { userId: req.user.userId } : { sessionId: sessionIdFrom(req) };
}

// GET /cart - The caller's priced cart (guests also get their sessionId)
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    return sendSuccess(res, await CartService.view(accessFrom(req)));
  })
);

// GET /cart/summary - Same priced cart; kept for older clients
router.get(
  '/summary',
  optionalAuth,
  asyncHandler(async (req, res) => {
    return sendSuccess(res, await CartService.view(accessFrom(req)));
  })
);

// PUT /cart/items/:productId - Set the exact quantity of a product; 0 removes it
router.put(
  '/items/:productId',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const productId = Number(req.params.productId);
    const quantity = Number(req.body?.quantity);
    const cart = await CartService.setLineQuantity(accessFrom(req), productId, quantity);
    return sendSuccess(res, cart);
  })
);

// POST /cart/reorder - Add one of the customer's orders back into their cart
router.post(
  '/reorder',
  optionalAuth,
  asyncHandler(async (req, res) => {
    if (!req.user?.userId) return sendError(res, 401, 'Sign in to reorder an order.');
    const orderId = Number(req.body?.orderId);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return sendError(res, 400, 'orderId must be an order number.');
    }
    return sendSuccess(res, await CartService.reorder(req.user.userId, orderId));
  })
);

// POST /cart/merge - After sign-in, move the guest cart into the account cart
router.post(
  '/merge',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user?.userId) return sendError(res, 403, 'Only customers have a cart');
    const cart = await CartService.mergeGuestCart(req.user.userId, req.body?.sessionId);
    return sendSuccess(res, cart);
  })
);

// POST /cart/items - Add item to cart (older clients)
router.post(
  '/items',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { cartId, variantId, productId, quantity } = req.body;
    if (!cartId || (!variantId && !productId)) {
      return sendError(res, 400, 'cartId and either variantId or productId are required');
    }

    const sessionId = sessionIdFrom(req);
    const item = await CartService.addItem(
      Number(cartId),
      variantId ? Number(variantId) : undefined,
      Number(quantity) || 1,
      productId ? Number(productId) : undefined,
      { userId: req.user?.userId, sessionId }
    );
    return sendSuccess(res, item, 'Item added to cart');
  })
);

// POST /cart/checkout - Place a cash-on-delivery order from the caller's cart; repeating it returns the same order
router.post(
  '/checkout',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { order, replay } = await CartCheckoutService.place(accessFrom(req), req.body ?? {});
    return sendSuccess(res, order, replay ? 'Order already placed' : 'Order placed', replay ? 200 : 201);
  })
);

// DELETE /cart/items/:id - Remove item (older clients)
router.delete(
  '/items/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const cartId = Number(req.query.cartId);
    if (!cartId) return sendError(res, 400, 'cartId query param required');

    const sessionId = sessionIdFrom(req);
    await CartService.removeItem(cartId, Number(req.params.id), {
      userId: req.user?.userId,
      sessionId,
    });
    return sendSuccess(res, { success: true }, 'Item removed from cart');
  })
);

// DELETE /cart - Empty the caller's cart (or a given cartId for older clients)
router.delete(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const cartId = Number(req.query.cartId);
    if (!cartId) return sendSuccess(res, await CartService.emptyCart(accessFrom(req)));

    const sessionId = sessionIdFrom(req);
    await CartService.clearCart(cartId, { userId: req.user?.userId, sessionId });
    return sendSuccess(res, { success: true }, 'Cart cleared');
  })
);

export default router;
