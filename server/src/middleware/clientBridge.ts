import { Request, Response, NextFunction } from 'express';
import { BRIDGE_AUD_CLIENT } from '../config/bridgeAuth.js';
import { userPool } from '../db/mysql.js';
import { sendError } from '../utils/response.js';

async function customerExists(userId: number): Promise<boolean> {
  try {
    const [rows] = await userPool.query<any[]>(
      `SELECT user_id FROM users WHERE user_id = ? AND COALESCE(is_active, 1) = 1 LIMIT 1`,
      [userId]
    );
    return rows.length > 0;
  } catch (err) {
    console.error('[bridge] customer lookup failed', err);
    throw Object.assign(new Error("Can't check the customer right now."), { statusCode: 503 });
  }
}

/**
 * Homecare exchange tokens are default-deny: `extractAuth` only attaches `req.bridge`.
 * This middleware checks scopes, verifies the customer exists, then sets `req.user.userId`.
 * Store Expo JWTs skip (no `req.bridge`).
 */
export function allowClientBridge(...scopes: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const bridge = req.bridge;
    if (!bridge) return next();
    if (bridge.aud !== BRIDGE_AUD_CLIENT) {
      return sendError(res, 403, 'This route does not accept a server bridge token.');
    }
    for (const need of scopes) {
      if (!bridge.scopes.includes(need)) {
        return sendError(res, 403, 'Bridge token is missing required scope.');
      }
    }
    try {
      if (!(await customerExists(bridge.sub))) {
        return sendError(res, 401, 'Unknown customer for bridge token.');
      }
    } catch (err: any) {
      return sendError(res, Number(err?.statusCode) || 503, err?.message || 'Customer check failed.');
    }
    req.user = { ...(req.user || {}), userId: bridge.sub };
    next();
  };
}

/** Profile / address / wishlist stay off Homecare exchange tokens. */
export function forbidClientBridge(req: Request, res: Response, next: NextFunction) {
  if (req.bridge?.aud === BRIDGE_AUD_CLIENT) {
    return sendError(res, 403, 'This action is not available with a Homecare store token.');
  }
  next();
}
