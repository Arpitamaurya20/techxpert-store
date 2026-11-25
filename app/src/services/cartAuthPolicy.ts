/**
 * How cart calls identify the owner.
 *
 * Guest: `x-session-id` only.
 * Account, after merge: `Authorization: Bearer` only.
 * Signed in, merge not finished: still the original guest session, never a new one.
 * The API client is the only place that writes `Authorization`, so these helpers
 * do not also set it on the same request.
 */

export function isGuestOwnedCartPath(path: string): boolean {
  const bare = (path.startsWith('/') ? path : `/${path}`).split('?')[0];
  return bare === '/cart' || bare === '/cart/summary' || bare.startsWith('/cart/items');
}

/** Green JWT is attached except on cart reads that are still the guest cart. */
export function attachStoreJwtOnPath(path: string, hostIsGreen: boolean, accountLinked: boolean): boolean {
  if (!hostIsGreen) return false;
  if (isGuestOwnedCartPath(path) && !accountLinked) return false;
  return true;
}

export type CartHeaderInput = {
  token?: string;
  sessionId?: string;
  accountLinked: boolean;
};

/** Headers besides the Bearer token, which `apiClient` adds when `attachStoreJwtOnPath` is true. */
export function guestSessionHeader(input: CartHeaderInput): Record<string, string> {
  const token = input.token?.trim();
  if (token && input.accountLinked) return {};
  const sessionId = input.sessionId?.trim();
  return sessionId ? { 'x-session-id': sessionId } : {};
}

/** Full cart identity for tests and reviews. Bearer and session are never both sent. */
export function cartTransportHeaders(input: CartHeaderInput): Record<string, string> {
  const token = input.token?.trim();
  if (token && input.accountLinked) return { Authorization: `Bearer ${token}` };
  return guestSessionHeader(input);
}

/** Account cart replies must not replace the guest key needed to retry merge. */
export function shouldPersistGuestSession(signedIn: boolean): boolean {
  return !signedIn;
}

export type PricedIdentity = { id?: string; lineCount: number };

/**
 * After merge, GET /cart is the account cart. If that GET is a different empty
 * cart, keep the merged cart that actually holds the guest lines.
 */
export function preferCartAfterMerge(merged: PricedIdentity | null, fetched: PricedIdentity): 'merged' | 'fetched' {
  if (
    merged?.id &&
    fetched.id &&
    merged.id !== fetched.id &&
    fetched.lineCount === 0 &&
    merged.lineCount > 0
  ) {
    return 'merged';
  }
  return 'fetched';
}

export type CheckoutTransport =
  | { cartId: string | null; sendSession: boolean; sendJwt: boolean }
  | { error: string };

/** Checkout uses the account cart once merge has linked it. Guests stay on the session. */
export function checkoutTransport(input: {
  paymentMethod: 'COD' | 'PayU';
  signedIn: boolean;
  accountLinked: boolean;
  cartId: string | null;
}): CheckoutTransport {
  if (input.paymentMethod === 'PayU' && !input.signedIn) {
    return { error: 'Sign in to pay online.' };
  }
  if (input.signedIn && !input.accountLinked) {
    return { error: 'Your cart has not moved to your account yet. Retry, then check out.' };
  }
  if (input.signedIn && input.accountLinked) {
    return { cartId: input.cartId, sendSession: false, sendJwt: true };
  }
  return { cartId: input.cartId, sendSession: true, sendJwt: false };
}

/**
 * Reuse the Idempotency-Key only while the checkout payload is unchanged.
 * A changed cart, total, address, or payment method gets a new key so the
 * server does not reject it as a different body.
 */
export function reuseOrMintIdempotencyKey(
  current: { key: string | null; fingerprint: string | null },
  fingerprint: string,
  mint: () => string
): { key: string; fingerprint: string } {
  if (current.key && current.fingerprint === fingerprint) {
    return { key: current.key, fingerprint };
  }
  return { key: mint(), fingerprint };
}

/**
 * Drop the key when this attempt cannot be replayed.
 * A refusal, including "already in progress or used with a different body",
 * will not succeed with the same key. A failure that says the cart is unchanged
 * did not place an order, so the next tap must not replay that key.
 */
export function retireIdempotencyKey(status: number | undefined, message: string): boolean {
  if (/already in progress or used with a different body/i.test(message)) return true;
  if ((status ?? 500) < 500) return true;
  return /cart is unchanged/i.test(message);
}

/** Order of the sign-in handoff. Merge finishes before the account cart is shown. */
export const LOGIN_CART_SEQUENCE = [
  'persist-jwt',
  'keep-guest-session',
  'merge-with-bearer-and-original-session',
  'refresh-account-cart',
] as const;
