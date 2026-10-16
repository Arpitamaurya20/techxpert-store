import { Router } from 'express';
import { PricingService } from '../services/pricingService.js';
import { asyncHandler, sendSuccess, sendError } from '../utils/response.js';

const router = Router();

// GET /pricing/bulk-tiers
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
  asyncHandler(async (req, res) => {
    const newTier = await PricingService.createBulkTier(req.body);
    return sendSuccess(res, newTier, 'Bulk pricing tier created', 201);
  })
);

// DELETE /pricing/bulk-tiers/:id
router.delete(
  '/bulk-tiers/:id',
  asyncHandler(async (req, res) => {
    await PricingService.deleteBulkTier(req.params.id);
    return sendSuccess(res, { success: true }, 'Bulk pricing tier removed');
  })
);

// GET /pricing/calculate - Calculate discounted price for a given quantity
router.get(
  '/calculate',
  asyncHandler(async (req, res) => {
    const { productId, quantity, basePrice } = req.query;
    if (!productId || !quantity || !basePrice) {
      return sendError(res, 400, 'productId, quantity, and basePrice are required');
    }

    const calculation = await PricingService.calculateBulkPrice(
      Number(productId),
      Number(quantity),
      Number(basePrice)
    );
    return sendSuccess(res, calculation);
  })
);

export default router;
