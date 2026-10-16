import { Router } from 'express';
import { CmsService } from '../services/cmsService.js';
import { asyncHandler, sendSuccess, sendError } from '../utils/response.js';

const router = Router();

// GET /cms/banners - List all banners
router.get(
  '/banners',
  asyncHandler(async (req, res) => {
    const banners = await CmsService.getBanners(req.query.status as string);
    return sendSuccess(res, banners);
  })
);

// POST /cms/banners - Create banner
router.post(
  '/banners',
  asyncHandler(async (req, res) => {
    const banner = await CmsService.createBanner(req.body);
    return sendSuccess(res, banner, 'Banner created successfully', 201);
  })
);

// PUT /cms/banners/:id - Update banner
router.put(
  '/banners/:id',
  asyncHandler(async (req, res) => {
    const updated = await CmsService.updateBanner(req.params.id, req.body);
    return sendSuccess(res, updated, 'Banner updated successfully');
  })
);

// DELETE /cms/banners/:id - Delete banner
router.delete(
  '/banners/:id',
  asyncHandler(async (req, res) => {
    await CmsService.deleteBanner(req.params.id);
    return sendSuccess(res, { success: true }, 'Banner removed');
  })
);

// PUT /cms/banners/reorder - Batch reorder banners
router.put(
  '/banners/reorder',
  asyncHandler(async (req, res) => {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) return sendError(res, 400, 'items array is required');
    const result = await CmsService.reorderBanners(items);
    return sendSuccess(res, result, 'Banners reordered');
  })
);

// GET /cms/sections - Homepage layout dynamic sections
router.get(
  '/sections',
  asyncHandler(async (_req, res) => {
    const sections = await CmsService.getSections();
    return sendSuccess(res, sections);
  })
);

export default router;
