import { isUsableSessionId, mergeQuantity, type CartLimits } from './cartRules.js';

/** Homecare customer id carried on the Store JWT. Not a row in the store `users` table. */
export function customerId(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : Number.NaN;
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
}

/**
 * Signed-in calls own the account cart by JWT userId alone.
 * A guest session sent beside the token must not become the cart owner.
 */
export function cartOwner(input: { userId?: unknown; sessionId?: unknown }): { userId?: number; sessionId?: string } {
  const userId = customerId(input.userId);
  if (userId) return { userId };
  if (isUsableSessionId(input.sessionId)) return { sessionId: input.sessionId };
  return {};
}

export type AccountCartCandidate = { id: number; userId: number; itemCount: number };

/** The account cart that already has lines, otherwise the oldest active one. Never a guest cart. */
export function chooseAccountCart(carts: AccountCartCandidate[]): AccountCartCandidate | null {
  const accounts = carts.filter((cart) => Number.isInteger(cart.id) && cart.id > 0 && customerId(cart.userId) != null);
  if (!accounts.length) return null;
  return [...accounts].sort((a, b) => {
    const byItems = Number(b.itemCount > 0) - Number(a.itemCount > 0);
    if (byItems !== 0) return byItems;
    return a.id - b.id;
  })[0];
}

export function checkoutMayUseCart(
  cart: { userId: number | null; sessionId: string | null },
  access: { userId?: number; sessionId?: string }
): boolean {
  const userId = customerId(access.userId);
  if (userId) return customerId(cart.userId) === userId;
  if (!isUsableSessionId(access.sessionId)) return false;
  return cart.userId == null && cart.sessionId === access.sessionId;
}

export function paymentMethodAllowed(
  method: unknown,
  userId: unknown
): { ok: true; method: 'COD' | 'PayU' } | { ok: false; status: number; message: string } {
  const normalized = method == null || method === '' ? 'COD' : String(method).trim().toUpperCase();
  if (normalized === 'PAYU') {
    if (!customerId(userId)) return { ok: false, status: 401, message: 'Sign in to pay online.' };
    return { ok: true, method: 'PayU' };
  }
  if (normalized === 'COD') return { ok: true, method: 'COD' };
  return { ok: false, status: 400, message: 'Only cash on delivery is available.' };
}

export type MergeSourceLine = {
  side: 'account' | 'guest';
  variantId: number;
  productId: number;
  quantity: number;
};

export type GroupedMerge = { productId: number; account?: number; guest?: number };

/** One row per variant. Same-side duplicates keep the larger quantity, not the sum. */
export function groupMergeLines(lines: MergeSourceLine[]): Map<number, GroupedMerge> {
  const grouped = new Map<number, GroupedMerge>();
  for (const line of lines) {
    const variantId = Number(line.variantId);
    if (!Number.isInteger(variantId) || variantId <= 0) continue;
    const entry = grouped.get(variantId) ?? { productId: Number(line.productId) };
    const qty = Number(line.quantity);
    if (!Number.isFinite(qty)) {
      grouped.set(variantId, entry);
      continue;
    }
    if (line.side === 'account') entry.account = Math.max(entry.account ?? 0, qty);
    else entry.guest = Math.max(entry.guest ?? 0, qty);
    grouped.set(variantId, entry);
  }
  return grouped;
}

/** Variants the guest cart still contributes. An account-only group is a repeated merge and transfers nothing. */
export function variantsToTransfer(grouped: Map<number, GroupedMerge>): [number, GroupedMerge][] {
  return [...grouped.entries()].filter(([, quantities]) => quantities.guest != null);
}

export function transferredQuantity(
  quantities: GroupedMerge,
  limits: CartLimits | null
): number | null {
  if (quantities.guest == null || limits == null) return null;
  return mergeQuantity(quantities.account, quantities.guest, limits);
}
