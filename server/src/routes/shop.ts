import { Router } from 'express';
import { ShopSettingsService } from '../services/shopSettingsService.js';
import { asyncHandler, sendSuccess } from '../utils/response.js';
import { accessActor, requireAdmin, requirePermission } from '../middleware/auth.js';

const router = Router();

/** What the app can tell a customer. A null rule is switched off. */
router.get(
  '/rules',
  asyncHandler(async (_req, res) => {
    return sendSuccess(res, await ShopSettingsService.publicRules());
  })
);

router.get(
  '/settings',
  requireAdmin,
  requirePermission('settings', 'view'),
  asyncHandler(async (_req, res) => {
    return sendSuccess(res, await ShopSettingsService.read());
  })
);

router.put(
  '/settings',
  requireAdmin,
  requirePermission('settings', 'edit'),
  asyncHandler(async (req, res) => {
    const saved = await ShopSettingsService.save(req.body ?? {}, accessActor(req).name);
    return sendSuccess(res, saved, 'Shop settings saved');
  })
);

export default router;
