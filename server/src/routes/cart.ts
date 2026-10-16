import { Router } from 'express';
import { CartService } from '../services/cartService.js';
import { asyncHandler, sendSuccess, sendError } from '../utils/response.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

// GET /cart - Get or create user/session cart
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const sessionId = (req.headers['x-session-id'] as string) || (req.query.sessionId as string);
    const cart = await CartService.getOrCreateCart(req.user?.userId, sessionId);
    return sendSuccess(res, cart);
  })
);

// POST /cart/items - Add item to cart
router.post(
  '/items',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { cartId, variantId, quantity } = req.body;
    if (!cartId || !variantId) return sendError(res, 400, 'cartId and variantId are required');

    const item = await CartService.addItem(Number(cartId), Number(variantId), Number(quantity) || 1);
    return sendSuccess(res, item, 'Item added to cart');
  })
);

// DELETE /cart/items/:id - Remove item
router.delete(
  '/items/:id',
  asyncHandler(async (req, res) => {
    const cartId = Number(req.query.cartId);
    if (!cartId) return sendError(res, 400, 'cartId query param required');

    await CartService.removeItem(cartId, Number(req.params.id));
    return sendSuccess(res, { success: true }, 'Item removed from cart');
  })
);

// DELETE /cart - Clear cart
router.delete(
  '/',
  asyncHandler(async (req, res) => {
    const cartId = Number(req.query.cartId);
    if (!cartId) return sendError(res, 400, 'cartId query param required');

    await CartService.clearCart(cartId);
    return sendSuccess(res, { success: true }, 'Cart cleared');
  })
);

export default router;
