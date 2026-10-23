import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.js';

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Simple in-memory rate limiter (per-process). Fine for single-node / local.
 * For multi-instance production, replace with Redis-backed limiter.
 */
export function rateLimit(options: {
  windowMs: number;
  max: number;
  keyFn?: (req: Request) => string;
  message?: string;
}) {
  const { windowMs, max, keyFn, message } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = (keyFn ? keyFn(req) : req.ip || 'unknown') + ':' + req.path;
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      return sendError(res, 429, message || 'Too many requests — try again later');
    }

    next();
  };
}

/** Admin login: 10 attempts / 15 minutes per IP+email */
export const adminLoginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyFn: (req) => {
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    return `${req.ip || 'unknown'}:admin-login:${email}`;
  },
  message: 'Too many login attempts. Wait 15 minutes and try again.',
});

/** Own password change: 10 attempts / 15 minutes per signed-in staff member. Mount after the session check. */
export const passwordChangeRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyFn: (req) => `staff-password:${req.user?.staffId ?? req.ip ?? 'unknown'}`,
  message: 'Too many password attempts. Wait 15 minutes and try again.',
});
