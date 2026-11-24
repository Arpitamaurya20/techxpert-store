import { Router } from 'express';
import { CONTRACT_VERSION } from '../config/bridgeAuth.js';
import { bridgeServiceRateLimit, requireS2SOrdersRead } from '../middleware/bridgeTokenAuth.js';
import { ServiceOrdersService } from '../services/serviceOrdersService.js';
import { asyncHandler, sendError, sendSuccess } from '../utils/response.js';

const router = Router();

router.use(bridgeServiceRateLimit);

/**
 * GET /service/v1/orders — Homecare S2S only (bridge aud techxpert-store-s2s, scope orders:read).
 * Public Apache must 403 this path; Node still verifies the token.
 */
router.get(
  '/v1/orders',
  requireS2SOrdersRead,
  asyncHandler(async (req, res) => {
    const userId = req.bridge?.sub ?? req.user?.userId;
    if (!userId) {
      return sendError(res, 401, 'Bridge authentication required.');
    }

    res.setHeader('X-Contract-Version', CONTRACT_VERSION);

    const page = await ServiceOrdersService.listForCustomer(userId, {
      before: req.query.before,
      limit: req.query.limit,
    });

    return sendSuccess(res, page.items, undefined, 200, {
      nextCursor: page.nextCursor,
      limit: page.meta.limit,
      contractVersion: page.meta.contractVersion,
    });
  })
);

export default router;
