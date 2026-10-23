import { Router } from 'express';
import { AccessService } from '../services/accessService.js';
import { asyncHandler, sendError, sendSuccess } from '../utils/response.js';
import { accessActor, permissionRefusal, requireAdmin, requirePermission } from '../middleware/auth.js';
import { can } from '../utils/permissions.js';

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

// GET /access/staff - The store's staff list (store logins and linked Homecare logins) with roles and places
router.get(
  '/staff',
  requireAdmin,
  requirePermission('access', 'view'),
  asyncHandler(async (req, res) => {
    return sendSuccess(res, await AccessService.listStaff(accessActor(req)));
  })
);

// POST /access/staff - { name, email }: new store login; the temporary password is in the response, once
router.post(
  '/staff',
  requireAdmin,
  requirePermission('access', 'edit'),
  asyncHandler(async (req, res) => {
    const result = await AccessService.addStoreLogin(accessActor(req), req.body ?? {});
    return sendSuccess(res, result, 'Staff login created', 201);
  })
);

// GET /access/staff/homecare-match?email= - Exact email only: the active, unlinked Homecare login's name, or 404
router.get(
  '/staff/homecare-match',
  requireAdmin,
  requirePermission('access', 'edit'),
  asyncHandler(async (req, res) => {
    return sendSuccess(res, await AccessService.homecareMatch(req.query.email));
  })
);

// POST /access/staff/link - { email }: link that Homecare login to the store portal
router.post(
  '/staff/link',
  requireAdmin,
  requirePermission('access', 'edit'),
  asyncHandler(async (req, res) => {
    const staff = await AccessService.linkHomecare(accessActor(req), req.body ?? {});
    return sendSuccess(res, staff, 'Homecare login linked', 201);
  })
);

// PATCH /access/staff/:staffId - { name } (store logins, Edit) and/or { active } (Delete)
router.patch(
  '/staff/:staffId',
  requireAdmin,
  requirePermission('access', 'edit'),
  asyncHandler(async (req, res) => {
    if (req.body?.active !== undefined && !can(req.user!.access!.permissions, 'access', 'delete')) {
      return sendError(res, 403, permissionRefusal('access', 'delete'));
    }
    const staff = await AccessService.updateStaff(accessActor(req), Number(req.params.staffId), req.body ?? {});
    return sendSuccess(res, staff, 'Staff updated');
  })
);

// POST /access/staff/:staffId/reset-password - New temporary password (store logins); their sessions end
router.post(
  '/staff/:staffId/reset-password',
  requireAdmin,
  requirePermission('access', 'edit'),
  asyncHandler(async (req, res) => {
    const result = await AccessService.resetStaffPassword(accessActor(req), Number(req.params.staffId));
    return sendSuccess(res, result, 'Temporary password created');
  })
);

// PUT /access/staff/:staffId - { roleId } to assign, { roleId: null } to remove
router.put(
  '/staff/:staffId',
  requireAdmin,
  requirePermission('access', 'edit'),
  asyncHandler(async (req, res) => {
    const roleId = req.body?.roleId;
    if (roleId !== null && !(Number.isInteger(roleId) && roleId > 0)) {
      return sendError(res, 400, 'Choose a role, or none to remove access.');
    }
    const staff = await AccessService.assignStaff(accessActor(req), Number(req.params.staffId), roleId);
    return sendSuccess(res, staff, roleId === null ? 'Access removed' : 'Role assigned');
  })
);

// PUT /access/staff/:staffId/scope - { all: true } or { all: false, nodes: [{ type: 'group'|'store', id }] }
router.put(
  '/staff/:staffId/scope',
  requireAdmin,
  requirePermission('access', 'edit'),
  asyncHandler(async (req, res) => {
    const staff = await AccessService.setStaffScope(accessActor(req), Number(req.params.staffId), req.body ?? {});
    return sendSuccess(res, staff, 'Places updated');
  })
);

export default router;
