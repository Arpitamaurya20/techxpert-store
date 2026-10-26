import { Router } from 'express';
import { ShopSettingsService } from '../services/shopSettingsService.js';
import { TalkRequestService } from '../services/talkRequestService.js';
import { StaffAlertService } from '../services/staffAlertService.js';
import { readAlertSeen } from '../utils/staffAlert.js';
import { storeFilter } from '../utils/scope.js';
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

/** A customer asks staff to look at a cart. Nothing is ordered and no stock is held. */
router.post(
  '/requests',
  asyncHandler(async (req, res) => {
    return sendSuccess(res, await TalkRequestService.create(req.body ?? {}), 'Request sent');
  })
);

router.get(
  '/requests',
  requireAdmin,
  requirePermission('requests', 'view'),
  asyncHandler(async (req, res) => {
    return sendSuccess(res, await TalkRequestService.list(storeFilter(accessActor(req).access.scope)));
  })
);

router.put(
  '/requests/:id',
  requireAdmin,
  requirePermission('requests', 'edit'),
  asyncHandler(async (req, res) => {
    const actor = accessActor(req);
    const saved = await TalkRequestService.setStatus(req.params.id, req.body ?? {}, storeFilter(actor.access.scope), actor.name);
    return sendSuccess(res, saved, 'Request updated');
  })
);

/** Unseen customer orders and Talk to us requests for this person's places. */
router.get(
  '/alerts',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const actor = accessActor(req);
    return sendSuccess(res, await StaffAlertService.list(actor.access.scope, actor.access.permissions));
  })
);

router.put(
  '/alerts/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    readAlertSeen(req.body ?? {});
    const actor = accessActor(req);
    const saved = await StaffAlertService.see(req.params.id, actor.access.scope, actor.access.permissions);
    return sendSuccess(res, saved, 'Seen');
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
