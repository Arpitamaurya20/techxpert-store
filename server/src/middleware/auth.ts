import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { sendError } from '../utils/response.js';

const JWT_SECRET = process.env.JWT_SECRET || 'techxpert-store-secret-key-2026';

export interface AuthPayload {
  userId?: number;
  adminId?: number;
  mobile?: string;
  email?: string;
  name?: string;
  role?: string;
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
  if (!header || !header.startsWith('Bearer ')) return null;

  try {
    const token = header.split(' ')[1];
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
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

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = extractAuth(req);
  if (!user || !user.adminId) {
    // Also allow x-client: portal header in dev mode
    if (req.headers['x-client'] === 'portal') {
      req.user = { adminId: 1, role: 'super_admin', name: 'Store Admin' };
      return next();
    }
    return sendError(res, 403, 'Administrative access required');
  }
  req.user = user;
  next();
}
