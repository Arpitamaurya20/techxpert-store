import { Router } from 'express';
import { StoreTreeService } from '../services/storeTreeService.js';
import { asyncHandler, sendError, sendSuccess } from '../utils/response.js';
import { accessActor, permissionRefusal, requireAdmin, requirePermission } from '../middleware/auth.js';
import { can } from '../utils/permissions.js';

const router = Router();

// GET /stores/tree - Groups and stores inside your places
router.get(
  '/tree',
  requireAdmin,
  requirePermission('stores', 'view'),
  asyncHandler(async (req, res) => {
    return sendSuccess(res, await StoreTreeService.tree(accessActor(req)));
  })
);

// POST /stores/groups - { name, kind?, parentId? }
router.post(
  '/groups',
  requireAdmin,
  requirePermission('stores', 'edit'),
  asyncHandler(async (req, res) => {
    const group = await StoreTreeService.createGroup(accessActor(req), req.body ?? {});
    return sendSuccess(res, group, 'Group created', 201);
  })
);

// PUT /stores/groups/:id - Rename, relabel or move { name?, kind?, parentId? }
router.put(
  '/groups/:id',
  requireAdmin,
  requirePermission('stores', 'edit'),
  asyncHandler(async (req, res) => {
    const group = await StoreTreeService.updateGroup(accessActor(req), Number(req.params.id), req.body ?? {});
    return sendSuccess(res, group, 'Group updated');
  })
);

// DELETE /stores/groups/:id - Only an empty group nobody covers
router.delete(
  '/groups/:id',
  requireAdmin,
  requirePermission('stores', 'delete'),
  asyncHandler(async (req, res) => {
    const result = await StoreTreeService.deleteGroup(accessActor(req), Number(req.params.id));
    return sendSuccess(res, result, 'Group deleted');
  })
);

// POST /stores - { name, pincode, groupId?, contactNumber?, email?, address? }
router.post(
  '/',
  requireAdmin,
  requirePermission('stores', 'edit'),
  asyncHandler(async (req, res) => {
    const store = await StoreTreeService.createStore(accessActor(req), req.body ?? {});
    return sendSuccess(res, store, 'Store created', 201);
  })
);

// PUT /stores/:id - Details, { groupId } to move, { active } (deactivating needs stores delete)
router.put(
  '/:id',
  requireAdmin,
  requirePermission('stores', 'edit'),
  asyncHandler(async (req, res) => {
    if (req.body?.active === false && !can(req.user!.access!.permissions, 'stores', 'delete')) {
      return sendError(res, 403, permissionRefusal('stores', 'delete'));
    }
    const store = await StoreTreeService.updateStore(accessActor(req), Number(req.params.id), req.body ?? {});
    return sendSuccess(res, store, 'Store updated');
  })
);

// GET /stores/:id/pincodes - Current and past pincode links
router.get(
  '/:id/pincodes',
  requireAdmin,
  requirePermission('stores', 'view'),
  asyncHandler(async (req, res) => {
    return sendSuccess(res, await StoreTreeService.storePincodes(accessActor(req), Number(req.params.id)));
  })
);

// POST /stores/:id/pincodes - { pincode } served by this store from now on
router.post(
  '/:id/pincodes',
  requireAdmin,
  requirePermission('stores', 'edit'),
  asyncHandler(async (req, res) => {
    const links = await StoreTreeService.linkPincode(accessActor(req), Number(req.params.id), req.body ?? {});
    return sendSuccess(res, links, 'Pincode linked', 201);
  })
);

// DELETE /stores/:id/pincodes/:pincodeId - Stop serving it (orders to it are refused until relinked)
router.delete(
  '/:id/pincodes/:pincodeId',
  requireAdmin,
  requirePermission('stores', 'edit'),
  asyncHandler(async (req, res) => {
    const links = await StoreTreeService.unlinkPincode(
      accessActor(req),
      Number(req.params.id),
      Number(req.params.pincodeId)
    );
    return sendSuccess(res, links, 'Pincode unlinked');
  })
);

export default router;
