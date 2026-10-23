import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { sendError } from '../utils/response.js';
import { getJwtSecret } from '../config/security.js';
import { StaffService, type StaffIdentity } from '../services/staffService.js';
import { AccessService, type AccessActor, type StaffAccess } from '../services/accessService.js';
import { ADMIN_COOKIE, getCookie } from '../utils/cookies.js';
import { can, hasAnyAccess, moduleLabel, type Level, type ModuleKey } from '../utils/permissions.js';
import { STAFF_TOKEN_AUDIENCE, staffIdFromClaims, type StaffKind } from '../utils/staffAccounts.js';

const JWT_SECRET = getJwtSecret();

export interface AuthPayload {
  userId?: number;
  /** Portal staff (portal_staff.ID), only from a token with the store-portal audience. */
  staffId?: number;
  mobile?: string;
  email?: string;
  name?: string;
  kind?: StaffKind;
  isSuperAdmin?: boolean;
  mustChangePassword?: boolean;
  iat?: number;
  /** Set by requireAdmin / resolveAdmin from the store role tables, never from the token. */
  access?: StaffAccess;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

/** Verified claims; `staffId` survives only on a portal staff token, so old `adminId` and Homecare tokens are not staff. */
function claimsFrom(token: string): AuthPayload | null {
  try {
    const raw = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
    const { access: _ignored, staffId: _claimed, adminId: _legacy, ...rest } = raw;
    const staffId = staffIdFromClaims(raw);
    return { ...(rest as AuthPayload), ...(staffId ? { staffId } : {}) };
  } catch {
    return null;
  }
}

export function extractAuth(req: Request): AuthPayload | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const claims = claimsFrom(header.split(' ')[1]);
    if (claims) return claims;
  }
  const cookieToken = getCookie(req, ADMIN_COOKIE);
  return cookieToken ? claimsFrom(cookieToken) : null;
}

export function signStaffToken(staff: StaffIdentity): string {
  return jwt.sign({ staffId: staff.id, name: staff.name, email: staff.email, kind: staff.kind }, JWT_SECRET, {
    expiresIn: '7d',
    audience: STAFF_TOKEN_AUDIENCE,
  });
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const user = extractAuth(req);
  if (user) req.user = user;
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = extractAuth(req);
  if (!user || (!user.userId && !user.staffId)) {
    return sendError(res, 401, 'Authentication required');
  }
  req.user = user;
  next();
}

type ResolvedStaff = AuthPayload & { staffId: number; access: StaffAccess };

const PASSWORD_CHANGE_FIRST = 'Change your temporary password first.';

/**
 * Checks the staff login is still on the list and active, and loads its permissions onto req.user.
 * Throws 401 (no or dead login), 403 (temporary password not changed yet) or 503 (tables unreadable).
 */
export async function resolveAdmin(
  req: Request,
  options: { allowPasswordChange?: boolean } = {}
): Promise<ResolvedStaff> {
  const user = extractAuth(req);
  if (!user?.staffId) {
    throw Object.assign(new Error('Administrative login required'), { statusCode: 401 });
  }
  const staff = await StaffService.assertActive(user.staffId, user.iat);
  if (staff.mustChangePassword && !options.allowPasswordChange) {
    throw Object.assign(new Error(PASSWORD_CHANGE_FIRST), { statusCode: 403, code: 'PASSWORD_CHANGE_REQUIRED' });
  }
  const access = await AccessService.forStaff(staff.id, staff.isSuperAdmin);
  const resolved: ResolvedStaff = {
    ...user,
    staffId: staff.id,
    name: staff.name,
    email: staff.email,
    kind: staff.kind,
    isSuperAdmin: staff.isSuperAdmin,
    mustChangePassword: staff.mustChangePassword,
    access,
  };
  req.user = resolved;
  return resolved;
}

/** A database failure is 503, not 401, so a blip never signs anyone out. */
function refuse(res: Response, err: any) {
  if (!err?.statusCode) {
    console.error('[auth] staff session check failed', err);
    return sendError(res, 503, "Can't check your session right now. Try again in a moment.");
  }
  return sendError(res, err.statusCode, err.message, err.code ? { code: err.code } : undefined);
}

/** Requires a live portal staff session (Bearer or HttpOnly cookie) that has set its own password. */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  resolveAdmin(req)
    .then(() => next())
    .catch((err) => refuse(res, err));
}

/** Like requireAdmin, but also lets in someone who still has to change their temporary password. */
export function requireAdminSession(req: Request, res: Response, next: NextFunction) {
  resolveAdmin(req, { allowPasswordChange: true })
    .then(() => next())
    .catch((err) => refuse(res, err));
}

/** True when the request carries a live staff session; used where staff see more than the public. */
export async function isActiveStaff(req: Request): Promise<boolean> {
  try {
    await resolveAdmin(req);
    return true;
  } catch {
    return false;
  }
}

export function permissionRefusal(module: ModuleKey, level: Level): string {
  return `You don't have ${level} access to ${moduleLabel(module)}.`;
}

/** After requireAdmin — the signed-in role must grant this level on this module. */
export function requirePermission(module: ModuleKey, level: Level) {
  return (req: Request, res: Response, next: NextFunction) => {
    const access = req.user?.access;
    if (!access || !can(access.permissions, module, level)) {
      return sendError(res, 403, permissionRefusal(module, level));
    }
    next();
  };
}

/** After requireAdmin — any portal access at all. */
export function requireAnyPermission(req: Request, res: Response, next: NextFunction) {
  const access = req.user?.access;
  if (!access || !hasAnyAccess(access.permissions)) {
    return sendError(res, 403, "You don't have access to the portal yet. Ask a store admin to assign you a role.");
  }
  next();
}

export function accessActor(req: Request): AccessActor {
  const user = req.user!;
  return { staffId: user.staffId!, name: user.name || 'Staff', access: user.access! };
}
