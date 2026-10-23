import { Router } from 'express';
import { AuditService } from '../services/auditService.js';
import { asyncHandler, sendSuccess, sendError } from '../utils/response.js';
import { requireAdmin, requireAnyPermission, requirePermission } from '../middleware/auth.js';

const router = Router();

// GET /audit/logs — newest first (staff with audit view)
router.get(
  '/logs',
  requireAdmin,
  requirePermission('audit', 'view'),
  asyncHandler(async (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const logs = await AuditService.list(limit);
    return sendSuccess(res, logs);
  })
);

// POST /audit/logs — append an immutable trail entry; the actor is the signed-in staff member
router.post(
  '/logs',
  requireAdmin,
  requireAnyPermission,
  asyncHandler(async (req, res) => {
    const { action, entity, details } = req.body || {};
    if (!action || !entity) {
      return sendError(res, 400, 'action and entity are required');
    }
    const user = `${req.user!.name || 'Staff'} (${req.user!.access?.roleName ?? 'no role'})`;
    const entry = await AuditService.create({ action, entity, details, user });
    return sendSuccess(res, entry, 'Audit log recorded', 201);
  })
);

export default router;
