/**
 * Blue + green Store bases (docs/APP_TEAM_PULL_BRIEF.md host map, docs/BLUE_GREEN.md).
 *
 *   BLUE  — default browse / CMS / search / wishlist / help
 *   GREEN — OTP, session, addresses, cart, delivery, checkout, PayU, green orders
 *
 * JWT and cart are host-scoped: green token only on green; green checkout uses a
 * green cart. Do not send Homecare hosts from this Store Expo app.
 */

import { accountCartLinked } from '@/state/cartLink';

import { attachStoreJwtOnPath } from './cartAuthPolicy';

const BLUE_DEFAULT = 'https://store.jiotechxpert.com/api';
const GREEN_DEFAULT = 'https://apitest.jiotechxpert.com/api';

function trimBase(value: string | undefined): string {
  return (value ?? '').trim().replace(/\/+$/, '');
}

const rawBlue = trimBase(process.env.EXPO_PUBLIC_API_BASE_URL);
const rawGreen = trimBase(process.env.EXPO_PUBLIC_GREEN_API_BASE_URL);

/** BLUE Store — catalog, CMS, search, wishlist, help (and anything not on the green list). */
export const BLUE_API_BASE_URL = rawBlue || (rawGreen ? '' : BLUE_DEFAULT);

/**
 * GREEN Store — OTP / me / addresses / cart / delivery / checkout / PayU / orders.
 * When unset, green paths fall back to BLUE (single-host local/dev).
 */
export const GREEN_API_BASE_URL = rawGreen || rawBlue || GREEN_DEFAULT;

/** @deprecated Prefer BLUE_API_BASE_URL or baseUrlFor(path). Kept for CMS asset resolution. */
export const API_BASE_URL = BLUE_API_BASE_URL || GREEN_API_BASE_URL;

export const isApiConfigured = /^https?:\/\/.+/i.test(API_BASE_URL) || /^https?:\/\/.+/i.test(GREEN_API_BASE_URL);

export const REQUEST_TIMEOUT_MS = 15_000;

/**
 * PayU needs a signed-in account cart (Store JWT). Guest checkout stays cash on delivery.
 * Set EXPO_PUBLIC_PAYU_ENABLED=1 to show Pay online.
 */
export const isPayUEnabled = process.env.EXPO_PUBLIC_PAYU_ENABLED === '1';

export type ApiHost = 'blue' | 'green';

/**
 * Paths that must hit GREEN during the dual-host window
 * (docs/STORE_CUSTOMER_API.md + APP_TEAM_PULL_BRIEF.md).
 */
export function apiHostFor(path: string): ApiHost {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (
    normalized.startsWith('/auth/') ||
    normalized === '/auth' ||
    normalized.startsWith('/cart') ||
    normalized.startsWith('/delivery/') ||
    normalized.startsWith('/payments/payu') ||
    normalized.startsWith('/orders')
  ) {
    return 'green';
  }
  return 'blue';
}

export function baseUrlFor(path: string): string {
  const host = apiHostFor(path);
  if (host === 'green') {
    return GREEN_API_BASE_URL || BLUE_API_BASE_URL;
  }
  return BLUE_API_BASE_URL || GREEN_API_BASE_URL;
}

/**
 * Green OTP JWT goes only to the green host.
 * Cart reads send it once the account cart is linked. Until merge finishes they stay
 * on the guest session, so a failed merge is not replaced by an empty account cart.
 * `/cart/merge` and `/cart/checkout` always send it when a token exists.
 */
export function shouldAttachGreenAuth(path: string): boolean {
  return attachStoreJwtOnPath(path, apiHostFor(path) === 'green', accountCartLinked());
}
