import { Router } from 'express';
import { CmsService } from '../services/cmsService.js';
import { HelpService } from '../services/helpService.js';
import { HomeMerchService } from '../services/homeMerchService.js';
import { SearchSuggestionService } from '../services/searchSuggestionService.js';
import { TrustClaimService } from '../services/trustClaimService.js';
import { AboutService } from '../services/aboutService.js';
import { PolicyService } from '../services/policyService.js';
import { asyncHandler, sendSuccess, sendError } from '../utils/response.js';
import { requireAdmin, requirePermission, optionalAuth, isActiveStaff } from '../middleware/auth.js';
import { validateBannerBody } from '../utils/validate.js';
import { readBannerUpload, storeBannerImage } from '../utils/bannerMedia.js';

const router = Router();

// GET /cms/banners
// - Anonymous / mobile: live campaigns only (published or scheduled, inside the window). Query status is ignored.
// - Active admin Bearer: all statuses by default; ?status= filters; ?status=all = no filter
router.get(
  '/banners',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const raw = req.query.status !== undefined ? String(req.query.status) : undefined;
    const isActiveAdmin = await isActiveStaff(req);

    let statusFilter: string | undefined;
    if (isActiveAdmin) {
      if (raw === 'all' || raw === undefined || raw === '') {
        statusFilter = undefined; // all statuses for portal
      } else {
        statusFilter = raw;
      }
    }

    const banners = await CmsService.getBanners(isActiveAdmin ? statusFilter : undefined, {
      audience: isActiveAdmin ? 'admin' : 'customer',
    });
    return sendSuccess(res, banners);
  })
);

// POST /cms/banners/media — store a JPEG, PNG, or WebP up to 2 MB
router.post(
  '/banners/media',
  requireAdmin,
  requirePermission('banners', 'edit'),
  asyncHandler(async (req, res) => {
    const bytes = await readBannerUpload(req);
    const stored = await storeBannerImage(bytes);
    return sendSuccess(res, stored, 'Campaign image stored', 201);
  })
);

// POST /cms/banners - Create banner
router.post(
  '/banners',
  requireAdmin,
  requirePermission('banners', 'edit'),
  asyncHandler(async (req, res) => {
    const body = validateBannerBody(req.body, false);
    const banner = await CmsService.createBanner(body);
    return sendSuccess(res, banner, 'Banner created successfully', 201);
  })
);

// PUT /cms/banners/:id - Update banner
router.put(
  '/banners/:id',
  requireAdmin,
  requirePermission('banners', 'edit'),
  asyncHandler(async (req, res) => {
    const body = validateBannerBody(req.body, true);
    const updated = await CmsService.updateBanner(req.params.id, body);
    return sendSuccess(res, updated, 'Banner updated successfully');
  })
);

// DELETE /cms/banners/:id - Delete banner
router.delete(
  '/banners/:id',
  requireAdmin,
  requirePermission('banners', 'delete'),
  asyncHandler(async (req, res) => {
    await CmsService.deleteBanner(req.params.id);
    return sendSuccess(res, { success: true }, 'Banner removed');
  })
);

// PUT /cms/banners/reorder - Batch reorder banners
router.put(
  '/banners/reorder',
  requireAdmin,
  requirePermission('banners', 'edit'),
  asyncHandler(async (req, res) => {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) return sendError(res, 400, 'items array is required');
    const result = await CmsService.reorderBanners(items);
    return sendSuccess(res, result, 'Banners reordered');
  })
);

// GET /cms/sections
// - Anonymous / mobile: enabled blocks the phone can draw, in desk order
// - Active admin: the same blocks, including hidden ones, so a toggle can turn them back on
router.get(
  '/sections',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const isActiveAdmin = await isActiveStaff(req);
    const sections = await CmsService.getSections({ audience: isActiveAdmin ? 'admin' : 'customer' });
    return sendSuccess(res, sections);
  })
);

// PUT /cms/sections/reorder - Batch reorder (must be before :id)
router.put(
  '/sections/reorder',
  requireAdmin,
  requirePermission('sections', 'edit'),
  asyncHandler(async (req, res) => {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) return sendError(res, 400, 'items array is required');
    const result = await CmsService.reorderSections(items);
    return sendSuccess(res, result, 'Sections reordered');
  })
);

// POST /cms/sections/reset - Restore SRS default order/visibility
router.post(
  '/sections/reset',
  requireAdmin,
  requirePermission('sections', 'delete'),
  asyncHandler(async (_req, res) => {
    const sections = await CmsService.resetSections();
    return sendSuccess(res, sections, 'Home screen sections reset to the defaults');
  })
);

// PUT /cms/sections/:id - Toggle / update a section
router.put(
  '/sections/:id',
  requireAdmin,
  requirePermission('sections', 'edit'),
  asyncHandler(async (req, res) => {
    const updated = await CmsService.updateSection(req.params.id, req.body);
    return sendSuccess(res, updated, 'Section updated');
  })
);

// GET /cms/home - Category shortcuts and project tiles. Empty until staff fill them in.
router.get(
  '/home',
  asyncHandler(async (_req, res) => {
    return sendSuccess(res, await HomeMerchService.get());
  })
);

// PUT /cms/home - Replace the shortcut row and project tiles (home screen sections edit)
router.put(
  '/home',
  requireAdmin,
  requirePermission('sections', 'edit'),
  asyncHandler(async (req, res) => {
    return sendSuccess(res, await HomeMerchService.save(req.body), 'Home shortcuts saved');
  })
);

// GET /cms/search-suggestions - Home search chips. Empty until staff fill them in.
router.get(
  '/search-suggestions',
  asyncHandler(async (_req, res) => {
    return sendSuccess(res, await SearchSuggestionService.get());
  })
);

// PUT /cms/search-suggestions - Replace the chips (home screen sections edit)
router.put(
  '/search-suggestions',
  requireAdmin,
  requirePermission('sections', 'edit'),
  asyncHandler(async (req, res) => {
    return sendSuccess(res, await SearchSuggestionService.save(req.body), 'Search ideas saved');
  })
);

// GET /cms/trust - Home trust-strip claims. Empty until staff fill them in.
router.get(
  '/trust',
  asyncHandler(async (_req, res) => {
    return sendSuccess(res, await TrustClaimService.get());
  })
);

// PUT /cms/trust - Replace the claims (home screen sections edit)
router.put(
  '/trust',
  requireAdmin,
  requirePermission('sections', 'edit'),
  asyncHandler(async (req, res) => {
    return sendSuccess(res, await TrustClaimService.save(req.body), 'Trust strip saved');
  })
);

// GET /cms/help - Phone, WhatsApp, email, hours and questions. Empty until staff fill them in.
router.get(
  '/help',
  asyncHandler(async (_req, res) => {
    return sendSuccess(res, await HelpService.get());
  })
);

// PUT /cms/help - Replace the help page (help edit)
router.put(
  '/help',
  requireAdmin,
  requirePermission('help', 'edit'),
  asyncHandler(async (req, res) => {
    return sendSuccess(res, await HelpService.save(req.body), 'Help page saved');
  })
);

// GET /cms/about - Mission, facts and values. Empty until staff fill them in.
router.get(
  '/about',
  asyncHandler(async (_req, res) => {
    return sendSuccess(res, await AboutService.get());
  })
);

// PUT /cms/about - Replace the about page (about edit)
router.put(
  '/about',
  requireAdmin,
  requirePermission('about', 'edit'),
  asyncHandler(async (req, res) => {
    return sendSuccess(res, await AboutService.save(req.body), 'About page saved');
  })
);

// GET /cms/policies - Privacy, terms, cancellation and shipping. Empty until staff paste them.
router.get(
  '/policies',
  asyncHandler(async (_req, res) => {
    return sendSuccess(res, await PolicyService.list());
  })
);

// PUT /cms/policies/:id - Replace one policy (policies edit). Empty lists clear that policy only.
router.put(
  '/policies/:id',
  requireAdmin,
  requirePermission('policies', 'edit'),
  asyncHandler(async (req, res) => {
    return sendSuccess(res, await PolicyService.save(req.params.id, req.body), 'Policy saved');
  })
);

export default router;
