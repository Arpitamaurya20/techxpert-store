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
    const { cartId, variantId, productId, quantity } = req.body;
    if (!cartId || (!variantId && !productId)) {
      return sendError(res, 400, 'cartId and either variantId or productId are required');
    }

    const item = await CartService.addItem(
      Number(cartId),
      variantId ? Number(variantId) : undefined,
      Number(quantity) || 1,
      productId ? Number(productId) : undefined
    );
    return sendSuccess(res, item, 'Item added to cart');
  })
);

// GET /cart/summary - Detailed pre-checkout calculation with bulk discounts and taxes
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const cartId = Number(req.query.cartId);
    if (!cartId) return sendError(res, 400, 'cartId query param is required');

    const summary = await CartService.getCartSummary(cartId);
    return sendSuccess(res, summary);
  })
);

// POST /cart/checkout - Atomic checkout flow converting active cart into order
router.post(
  '/checkout',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { cartId, addressId, shippingAddress, paymentMethod, notes, guestName, guestPhone, guestEmail } = req.body;
    if (!cartId) return sendError(res, 400, 'cartId is required');

    const order = await CartService.checkoutCart(Number(cartId), {
      userId: req.user?.userId || (req.body.userId ? Number(req.body.userId) : undefined),
      addressId: addressId ? Number(addressId) : undefined,
      shippingAddress,
      paymentMethod,
      notes,
      guestName,
      guestPhone,
      guestEmail,
    });

    return sendSuccess(res, order, 'Order confirmed and inventory reserved', 201);
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
