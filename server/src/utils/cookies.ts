import type { Request, Response } from 'express';
import { isProduction } from '../config/security.js';

export const ADMIN_COOKIE = 'tx_admin_token';

export function parseCookies(header?: string): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

export function getCookie(req: Request, name: string): string | undefined {
  return parseCookies(req.headers.cookie)[name];
}

export function setAdminTokenCookie(res: Response, token: string) {
  const maxAge = 7 * 24 * 60 * 60; // seconds
  const parts = [
    `${ADMIN_COOKIE}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (isProduction()) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

export function clearAdminTokenCookie(res: Response) {
  const parts = [
    `${ADMIN_COOKIE}=`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (isProduction()) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}
