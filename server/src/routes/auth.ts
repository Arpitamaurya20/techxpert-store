import { Router } from 'express';
import { AuthService } from '../services/authService.js';
import { asyncHandler, sendSuccess, sendError } from '../utils/response.js';
import { AccessService } from '../services/accessService.js';
import { requireAuth, requireAdmin, requirePermission } from '../middleware/auth.js';
import { adminLoginRateLimit } from '../middleware/rateLimit.js';
import { clearAdminTokenCookie, setAdminTokenCookie } from '../utils/cookies.js';

const router = Router();

// POST /auth/login - App mobile/email customer sign in
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { identifier } = req.body;
    if (!identifier) return sendError(res, 400, 'Mobile number or email is required');

    const result = await AuthService.login(identifier);
    return res.json(result); // Matches Mobile App SignInResponse format directly
  })
);

// POST /auth/send-otp - Request OTP for mobile authentication
router.post(
  '/send-otp',
  asyncHandler(async (req, res) => {
    const { phone, purpose } = req.body;
    if (!phone) return sendError(res, 400, 'Phone number is required');

    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const result = await AuthService.sendOtp(phone, purpose, ip);
    return sendSuccess(res, result, result.message);
  })
);

// POST /auth/verify-otp - Verify OTP and complete mobile login
router.post(
  '/verify-otp',
  asyncHandler(async (req, res) => {
    const { phone, otp, name, fullName, email } = req.body;
    if (!phone || !otp) return sendError(res, 400, 'Phone and OTP are required');

    const result = await AuthService.verifyOtp(phone, otp, {
      name: name || fullName,
      email,
    });
    return res.json(result);
  })
);

// GET /auth/me - Authenticated user profile
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const profile = await AuthService.getProfile(req.user!.userId!);
    return sendSuccess(res, profile);
  })
);

// GET /auth/addresses - Saved addresses from homecare.user_addresses
router.get(
  '/addresses',
  requireAuth,
  asyncHandler(async (req, res) => {
    const addresses = await AuthService.getAddresses(req.user!.userId!);
    return sendSuccess(res, addresses);
  })
);


// POST /auth/addresses - Add new address
router.post(
  '/addresses',
  requireAuth,
  asyncHandler(async (req, res) => {
    const newAddress = await AuthService.createAddress(req.user!.userId!, req.body);
    return sendSuccess(res, newAddress, 'Address saved successfully', 201);
  })
);

// PUT /auth/addresses/:id/default - Set default delivery address
router.put(
  '/addresses/:id/default',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await AuthService.setDefaultAddress(req.user!.userId!, Number(req.params.id));
    return sendSuccess(res, result, 'Default address updated');
  })
);

// DELETE /auth/addresses/:id - Soft delete address
router.delete(
  '/addresses/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await AuthService.deleteAddress(req.user!.userId!, Number(req.params.id));
    return sendSuccess(res, result, 'Address removed');
  })
);

// POST /auth/admin/login - Staff login for Operations Portal
router.post(
  '/admin/login',
  adminLoginRateLimit,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return sendError(res, 400, 'Email and password are required');

    const result = await AuthService.adminLogin(email, password);
    const access = await AccessService.forAdmin(result.admin.id, result.admin.role);
    setAdminTokenCookie(res, result.token);
    return sendSuccess(
      res,
      { ...result, admin: { ...result.admin, storeRole: access.roleName, permissions: access.permissions } },
      'Admin login successful'
    );
  })
);

// POST /auth/admin/logout - Clear HttpOnly admin cookie
router.post(
  '/admin/logout',
  asyncHandler(async (_req, res) => {
    clearAdminTokenCookie(res);
    return sendSuccess(res, { success: true }, 'Logged out');
  })
);

// GET /auth/admin/me - Current portal staff session (re-checks is_active)
router.get(
  '/admin/me',
  requireAdmin,
  asyncHandler(async (req, res) => {
    return sendSuccess(res, {
      id: req.user!.adminId,
      name: req.user!.name,
      email: req.user!.email,
      role: req.user!.role,
      storeRole: req.user!.access!.roleName,
      permissions: req.user!.access!.permissions,
    });
  })
);

// GET /auth/users - Portal endpoint to view customers & spend statistics
router.get(
  '/users',
  requireAdmin,
  requirePermission('customers', 'view'),
  asyncHandler(async (_req, res) => {
    const users = await AuthService.getAllUsers();
    return sendSuccess(res, users);
  })
);

export default router;
