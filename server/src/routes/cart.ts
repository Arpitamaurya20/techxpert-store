import { Router, type Request } from 'express';
import { CartService, type CartAccess } from '../services/cartService.js';
import { CartCheckoutService } from '../services/cartCheckoutService.js';
import {
  CheckoutIdempotencyService,
  hashCheckoutBody,
} from '../services/checkoutIdempotency.js';
import { asyncHandler, sendSuccess, sendError } from '../utils/response.js';
import { optionalAuth, requireCustomer } from '../middleware/auth.js';
import { allowClientBridge } from '../middleware/clientBridge.js';
import { chosenVariantId } from '../utils/variants.js';
import { resolveCheckoutChannel } from '../utils/checkoutChannel.js';

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
  allowClientBridge('cart'),
  asyncHandler(async (req, res) => {
    return sendSuccess(res, await CartService.view(accessFrom(req)));
  })
);

// GET /cart/summary - Same priced cart; kept for older clients
router.get(
  '/summary',
  optionalAuth,
  allowClientBridge('cart'),
  asyncHandler(async (req, res) => {
    return sendSuccess(res, await CartService.view(accessFrom(req)));
  })
);

// PUT /cart/items/:productId - Set the exact quantity of a product; 0 removes it
router.put(
  '/items/:productId',
  optionalAuth,
  allowClientBridge('cart'),
  asyncHandler(async (req, res) => {
    const productId = Number(req.params.productId);
    const quantity = Number(req.body?.quantity);
    const cart = await CartService.setLineQuantity(
      accessFrom(req),
      productId,
      quantity,
      chosenVariantId(req.body?.variantId)
    );
    return sendSuccess(res, cart);
  })
);

// POST /cart/reorder - Add one of the customer's orders back into their cart
router.post(
  '/reorder',
  optionalAuth,
  allowClientBridge('cart'),
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
  optionalAuth,
  allowClientBridge('cart'),
  requireCustomer,
  asyncHandler(async (req, res) => {
    const cart = await CartService.mergeGuestCart(req.user!.userId!, req.body?.sessionId);
    return sendSuccess(res, cart);
  })
);

// POST /cart/items - Add item to cart (older clients)
router.post(
  '/items',
  optionalAuth,
  allowClientBridge('cart'),
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
  allowClientBridge('cart', 'checkout'),
  asyncHandler(async (req, res) => {
    const body = { ...(req.body ?? {}) };
    body.channel = resolveCheckoutChannel({
      tokenChannel: req.bridge?.channel,
      bodyChannel: body.channel,
    });

    const idemKey = String(req.headers['idempotency-key'] || '').trim();
    const userId = req.user?.userId;
    if (idemKey && userId) {
      const requestHash = hashCheckoutBody(body);
      let decision;
      try {
        decision = await CheckoutIdempotencyService.begin(userId, idemKey, requestHash);
      } catch (err: any) {
        if (err?.code === 'ER_NO_SUCH_TABLE') {
          console.warn('[checkout] checkout_idempotency table missing — run sql/checkout_idempotency.sql');
          decision = { action: 'proceed' as const };
        } else {
          throw err;
        }
      }
      if (decision.action === 'conflict') {
        return sendError(res, 409, 'Checkout with this Idempotency-Key is already in progress or used with a different body.');
      }
      if (decision.action === 'replay') {
        res.status(decision.statusCode);
        res.type('json');
        return res.send(decision.responseJson);
      }
    }

    const { order, replay } = await CartCheckoutService.place(accessFrom(req), body);
    const status = replay ? 200 : 201;
    const message = replay ? 'Order already placed' : 'Order placed';
    if (idemKey && userId) {
      const payload = { success: true, data: order, message };
      try {
        await CheckoutIdempotencyService.complete(userId, idemKey, status, payload);
      } catch (err: any) {
        if (err?.code !== 'ER_NO_SUCH_TABLE') console.warn('[checkout] idempotency complete failed', err);
      }
    }
    return sendSuccess(res, order, message, status);
  })
);

// DELETE /cart/items/:id - Remove item (older clients)
router.delete(
  '/items/:id',
  optionalAuth,
  allowClientBridge('cart'),
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
  allowClientBridge('cart'),
  asyncHandler(async (req, res) => {
    const cartId = Number(req.query.cartId);
    if (!cartId) return sendSuccess(res, await CartService.emptyCart(accessFrom(req)));

    const sessionId = sessionIdFrom(req);
    await CartService.clearCart(cartId, { userId: req.user?.userId, sessionId });
    return sendSuccess(res, { success: true }, 'Cart cleared');
  })
);

export default router;
