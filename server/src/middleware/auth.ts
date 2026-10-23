import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { sendError } from '../utils/response.js';
import { getJwtSecret } from '../config/security.js';
import { AuthService } from '../services/authService.js';
import { AccessService, type AccessActor, type StaffAccess } from '../services/accessService.js';
import { ADMIN_COOKIE, getCookie } from '../utils/cookies.js';
import { can, hasAnyAccess, moduleLabel, type Level, type ModuleKey } from '../utils/permissions.js';

const JWT_SECRET = getJwtSecret();

export interface AuthPayload {
  userId?: number;
  adminId?: number;
  mobile?: string;
  email?: string;
  name?: string;
  role?: string;
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

export function extractAuth(req: Request): AuthPayload | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const token = header.split(' ')[1];
      const { access: _ignored, ...claims } = jwt.verify(token, JWT_SECRET) as AuthPayload;
      return claims;
    } catch {
      /* fall through to cookie */
    }
  }

  const cookieToken = getCookie(req, ADMIN_COOKIE);
  if (cookieToken) {
    try {
      const { access: _ignored, ...claims } = jwt.verify(cookieToken, JWT_SECRET) as AuthPayload;
      return claims;
    } catch {
      return null;
    }
  }

  return null;
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const user = extractAuth(req);
  if (user) req.user = user;
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = extractAuth(req);
  if (!user || (!user.userId && !user.adminId)) {
    return sendError(res, 401, 'Authentication required');
  }
  req.user = user;
  next();
}

/**
 * Checks the admin login is still active and loads its permissions onto req.user.
 * Throws with statusCode 401 (no or dead login) or 503 (access tables unreadable).
 */
export async function resolveAdmin(req: Request): Promise<AuthPayload & { adminId: number; access: StaffAccess }> {
  const user = extractAuth(req);
  if (!user?.adminId) {
    throw Object.assign(new Error('Administrative login required'), { statusCode: 401 });
  }
  const profile = await AuthService.assertActiveAdmin(user.adminId);
  const access = await AccessService.forAdmin(profile.id, profile.role);
  const resolved = {
    ...user,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    adminId: profile.id,
    access,
  };
  req.user = resolved;
  return resolved;
}

/** Requires a valid admin JWT (Bearer or HttpOnly cookie) whose admin_id is still active. */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  resolveAdmin(req)
    .then(() => next())
    .catch((err) => {
      const status = err.statusCode || 401;
      return sendError(res, status, err.message || 'Administrative login required');
    });
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
  return { adminId: user.adminId!, name: user.name || 'Staff', access: user.access! };
}
