import { Router, type Request } from 'express';
import { WishlistService, type WishlistAccess } from '../services/wishlistService.js';
import { asyncHandler, sendSuccess, sendError } from '../utils/response.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

function accessFrom(req: Request): WishlistAccess {
  const header = req.headers['x-session-id'];
  const sessionId = (Array.isArray(header) ? header[0] : header) || (req.query.sessionId as string) || req.body?.sessionId;
  return req.user?.userId ? { userId: req.user.userId } : { sessionId };
}

// GET /wishlist - The caller's saved products, newest first, at today's price and stock
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    return sendSuccess(res, await WishlistService.view(accessFrom(req)));
  })
);

// PUT /wishlist/:productId - { saved: true } saves it (and moves it to the front); false removes it
router.put(
  '/:productId',
  optionalAuth,
  asyncHandler(async (req, res) => {
    if (typeof req.body?.saved !== 'boolean') return sendError(res, 400, 'saved must be true or false.');
    const list = await WishlistService.setSaved(accessFrom(req), Number(req.params.productId), req.body.saved);
    return sendSuccess(res, list);
  })
);

// POST /wishlist/merge - After sign-in, keep the guest session and the ids saved on the device
router.post(
  '/merge',
  optionalAuth,
  asyncHandler(async (req, res) => {
    if (!req.user?.userId) return sendError(res, 401, 'Sign in to keep your saved items.');
    if (req.body?.productIds != null && !Array.isArray(req.body.productIds)) {
      return sendError(res, 400, 'productIds must be a list of product numbers.');
    }
    const list = await WishlistService.merge(req.user.userId, req.body?.sessionId, req.body?.productIds);
    return sendSuccess(res, list);
  })
);

export default router;
