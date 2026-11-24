import { Request, Response, NextFunction } from 'express';
import {
  BRIDGE_AUD_S2S,
  type BridgeAudience,
  type BridgeClaims,
  verifyBridgeToken,
} from '../config/bridgeAuth.js';
import { userPool } from '../db/mysql.js';
import { rateLimit } from './rateLimit.js';
import { sendError } from '../utils/response.js';

declare global {
  namespace Express {
    interface Request {
      bridge?: BridgeClaims;
    }
  }
}

async function customerExists(userId: number): Promise<boolean> {
  try {
    const [rows] = await userPool.query<any[]>(
      `SELECT user_id FROM users WHERE user_id = ? LIMIT 1`,
      [userId]
    );
    return rows.length > 0;
  } catch (err) {
    console.error('[bridge] customer lookup failed', err);
    throw Object.assign(new Error("Can't check the customer right now."), { statusCode: 503 });
  }
}

/**
 * Verifies a Homecare bridge Bearer token for the given audience/scopes,
 * ensures `sub` is an existing customer, and sets `req.bridge` + `req.user.userId`.
 */
export function requireBridgeToken(options: {
  audience: BridgeAudience;
  requiredScopes: string[];
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return sendError(res, 401, 'Bridge authentication required.');
    }
    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      return sendError(res, 401, 'Bridge authentication required.');
    }

    let claims: BridgeClaims;
    try {
      claims = verifyBridgeToken(token, options);
    } catch (err: any) {
      const status = Number(err?.statusCode) || 401;
      return sendError(res, status, err?.message || 'Invalid bridge token.');
    }

    try {
      if (!(await customerExists(claims.sub))) {
        return sendError(res, 401, 'Unknown customer for bridge token.');
      }
    } catch (err: any) {
      return sendError(res, Number(err?.statusCode) || 503, err?.message || 'Customer check failed.');
    }

    req.bridge = claims;
    req.user = { userId: claims.sub };

    console.log(
      JSON.stringify({
        msg: 'bridge_auth',
        actor: 'service:homecare',
        aud: claims.aud,
        userId: claims.sub,
        path: req.path,
        method: req.method,
      })
    );

    next();
  };
}

/** S2S Activity / order read — `orders:read` only. */
export const requireS2SOrdersRead = requireBridgeToken({
  audience: BRIDGE_AUD_S2S,
  requiredScopes: ['orders:read'],
});

/** Per Homecare process IP on /service (single-node in-memory). */
export const bridgeServiceRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.BRIDGE_S2S_RATE_MAX || 120),
  keyFn: (req) => `bridge-s2s:${req.ip || 'unknown'}`,
  message: 'Too many bridge requests. Try again shortly.',
});
