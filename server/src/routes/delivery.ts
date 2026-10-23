import { Router } from 'express';
import { DeliveryAreaService } from '../services/deliveryAreaService.js';
import { asyncHandler, sendError, sendSuccess } from '../utils/response.js';
import { requireAdmin, requirePermission } from '../middleware/auth.js';

const router = Router();

// GET /delivery/pincodes/:pincode - Public: do we deliver here?
router.get(
  '/pincodes/:pincode',
  asyncHandler(async (req, res) => {
    return sendSuccess(res, await DeliveryAreaService.check(req.params.pincode));
  })
);

// GET /delivery/pincodes - Staff: every pincode, active or paused
router.get(
  '/pincodes',
  requireAdmin,
  requirePermission('delivery', 'view'),
  asyncHandler(async (req, res) => {
    return sendSuccess(res, await DeliveryAreaService.list(req.user!.access!.scope));
  })
);

// POST /delivery/pincodes - Staff with delivery edit: { pincode, areaName, storeId? }
router.post(
  '/pincodes',
  requireAdmin,
  requirePermission('delivery', 'edit'),
  asyncHandler(async (req, res) => {
    const row = await DeliveryAreaService.add(req.body ?? {}, req.user!.access!.scope, req.user?.staffId);
    return sendSuccess(res, row, 'Delivery pincode added', 201);
  })
);

// PATCH /delivery/pincodes/:id - Staff with delivery edit: pause or resume
router.patch(
  '/pincodes/:id',
  requireAdmin,
  requirePermission('delivery', 'edit'),
  asyncHandler(async (req, res) => {
    if (typeof req.body?.active !== 'boolean') return sendError(res, 400, 'active must be true or false');
    const row = await DeliveryAreaService.setActive(
      Number(req.params.id),
      req.body.active,
      req.user!.access!.scope,
      req.user?.staffId
    );
    return sendSuccess(res, row, row.active ? 'Delivery resumed' : 'Delivery paused');
  })
);

export default router;
