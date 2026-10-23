import { Router } from 'express';
import { PricingService } from '../services/pricingService.js';
import { asyncHandler, sendSuccess, sendError } from '../utils/response.js';
import { requireAdmin, requirePermission } from '../middleware/auth.js';
import { validateBulkTierBody } from '../utils/validate.js';

const router = Router();

// GET /pricing/bulk-tiers (public for mobile product detail)
router.get(
  '/bulk-tiers',
  asyncHandler(async (req, res) => {
    const tiers = await PricingService.getBulkTiers(req.query.productId as string);
    return sendSuccess(res, tiers);
  })
);

// POST /pricing/bulk-tiers
router.post(
  '/bulk-tiers',
  requireAdmin,
  requirePermission('pricing', 'edit'),
  asyncHandler(async (req, res) => {
    const body = validateBulkTierBody(req.body);
    const newTier = await PricingService.createBulkTier(body);
    return sendSuccess(res, newTier, 'Bulk pricing tier created', 201);
  })
);

// PUT /pricing/bulk-tiers/:id — edit the row in place
router.put(
  '/bulk-tiers/:id',
  requireAdmin,
  requirePermission('pricing', 'edit'),
  asyncHandler(async (req, res) => {
    const body = validateBulkTierBody(req.body, true);
    const updated = await PricingService.updateBulkTier(req.params.id, body);
    return sendSuccess(res, updated, 'Bulk pricing tier updated');
  })
);

// DELETE /pricing/bulk-tiers/:id
router.delete(
  '/bulk-tiers/:id',
  requireAdmin,
  requirePermission('pricing', 'delete'),
  asyncHandler(async (req, res) => {
    await PricingService.deleteBulkTier(req.params.id);
    return sendSuccess(res, { success: true }, 'Bulk pricing tier removed');
  })
);

// GET /pricing/calculate - bulk price for a quantity, on the product's own price (a sent basePrice is ignored)
router.get(
  '/calculate',
  asyncHandler(async (req, res) => {
    const productId = Number(req.query.productId);
    const quantity = Number(req.query.quantity);
    if (!Number.isInteger(productId) || productId < 1 || !Number.isInteger(quantity) || quantity < 1) {
      return sendError(res, 400, 'productId and quantity must be whole numbers of at least 1');
    }

    const calculation = await PricingService.calculateForProduct(productId, quantity);
    return sendSuccess(res, calculation);
  })
);

export default router;
