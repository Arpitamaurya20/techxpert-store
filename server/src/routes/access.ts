import { Router } from 'express';
import { AccessService } from '../services/accessService.js';
import { asyncHandler, sendError, sendSuccess } from '../utils/response.js';
import { accessActor, requireAdmin, requirePermission } from '../middleware/auth.js';

const router = Router();

// GET /access/roles - Module catalogue and every store role
router.get(
  '/roles',
  requireAdmin,
  requirePermission('access', 'view'),
  asyncHandler(async (req, res) => {
    const roles = await AccessService.listRoles(accessActor(req));
    return sendSuccess(res, { modules: AccessService.modules(), roles });
  })
);

// POST /access/roles - Create a role within your own access
router.post(
  '/roles',
  requireAdmin,
  requirePermission('access', 'edit'),
  asyncHandler(async (req, res) => {
    const role = await AccessService.createRole(accessActor(req), req.body ?? {});
    return sendSuccess(res, role, 'Role created', 201);
  })
);

// PUT /access/roles/:id - Rename or change a role's modules
router.put(
  '/roles/:id',
  requireAdmin,
  requirePermission('access', 'edit'),
  asyncHandler(async (req, res) => {
    const role = await AccessService.updateRole(accessActor(req), Number(req.params.id), req.body ?? {});
    return sendSuccess(res, role, 'Role updated');
  })
);

// DELETE /access/roles/:id - Only when nobody holds it
router.delete(
  '/roles/:id',
  requireAdmin,
  requirePermission('access', 'delete'),
  asyncHandler(async (req, res) => {
    const result = await AccessService.deleteRole(accessActor(req), Number(req.params.id));
    return sendSuccess(res, result, 'Role deleted');
  })
);

// GET /access/staff - Every staff login with its store role
router.get(
  '/staff',
  requireAdmin,
  requirePermission('access', 'view'),
  asyncHandler(async (req, res) => {
    return sendSuccess(res, await AccessService.listStaff(accessActor(req)));
  })
);

// PUT /access/staff/:adminId - { roleId } to assign, { roleId: null } to remove
router.put(
  '/staff/:adminId',
  requireAdmin,
  requirePermission('access', 'edit'),
  asyncHandler(async (req, res) => {
    const roleId = req.body?.roleId;
    if (roleId !== null && !(Number.isInteger(roleId) && roleId > 0)) {
      return sendError(res, 400, 'Choose a role, or none to remove access.');
    }
    const staff = await AccessService.assignStaff(accessActor(req), Number(req.params.adminId), roleId);
    return sendSuccess(res, staff, roleId === null ? 'Access removed' : 'Role assigned');
  })
);

export default router;
