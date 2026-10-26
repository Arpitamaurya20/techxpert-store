import { loadCartSessionId, saveCartSessionId } from '@/state/cartSession';
import { getAuthToken } from '@/state/sessionStore';

import { ApiError, apiGet, apiPost, apiPut } from './apiClient';
import { asId, asList, asNumber, asRecord, asText } from './normalize';

/**
 * Server cart (JSON; Bearer token when signed in, `x-session-id` for guests):
 *
 *   GET    /cart                       → priced cart
 *   PUT    /cart/items/:productId      { quantity }  (0 removes) → priced cart
 *   POST   /cart/merge                 { sessionId } (signed in) → priced cart
 *
 * Orders are placed from this cart with `POST /cart/checkout` (see `orderApi.ts`).
 *
 *   priced cart = { id, sessionId? (guests), lines: [{ productId, name, brandName?, categoryId?, imageUrl?,
 *     unit, quantity, basePrice, unitPrice, appliedTier?, lineTotal, limits: { min, max, stock },
 *     problem }], totals: { subtotal, bulkSavings, delivery, tax, grandTotal }, canCheckout }
 *
 * A refused change comes back as an `ApiError` carrying the server's sentence.
 */

export type CartLineProblem = 'out_of_stock' | 'price_unavailable' | 'over_limit';

export type ServerCartLine = {
  productId: string;
  name: string;
  brandName?: string;
  categoryId: string;
  imageUrl?: string;
  unit?: string;
  quantity: number;
  basePrice?: number;
  unitPrice?: number;
  tierLabel?: string;
  lineTotal: number;
  min: number;
  max?: number;
  step: number;
  stock: number;
  variantId?: string;
  problem?: CartLineProblem;
};

export type CartTotals = {
  subtotal: number;
  bulkSavings: number;
  delivery: number;
  tax: number;
  grandTotal: number;
};

export type ServerCart = {
  /** The server's cart number; checkout sends it so a repeated request returns the same order. */
  id?: string;
  lines: ServerCartLine[];
  totals: CartTotals;
  canCheckout: boolean;
};

const PROBLEMS: CartLineProblem[] = ['out_of_stock', 'price_unavailable', 'over_limit'];

function tierLabel(raw: unknown): string | undefined {
  const tier = asRecord(raw);
  const minQty = asNumber(tier?.minQty);
  const value = asNumber(tier?.discountValue);
  if (!tier || minQty === undefined || value === undefined) return undefined;
  return tier.discountType === 'fixed_price' ? `Bulk price from ${minQty}` : `${value}% bulk discount from ${minQty}`;
}

function normalizeLine(raw: unknown): ServerCartLine | null {
  const record = asRecord(raw);
  const productId = asId(record?.productId);
  const name = asText(record?.name);
  const quantity = asNumber(record?.quantity);
  if (!record || !productId || !name || !quantity) return null;
  const limits = asRecord(record.limits);
  const problem = PROBLEMS.find((value) => value === record.problem);
  return {
    productId,
    name,
    brandName: asText(record.brandName),
    categoryId: asId(record.categoryId) ?? '',
    imageUrl: asText(record.imageUrl),
    unit: asText(record.unit),
    quantity: Math.floor(quantity),
    basePrice: asNumber(record.basePrice),
    unitPrice: asNumber(record.unitPrice),
    tierLabel: tierLabel(record.appliedTier),
    lineTotal: asNumber(record.lineTotal) ?? 0,
    min: Math.max(1, Math.floor(asNumber(limits?.min) ?? 1)),
    max: asNumber(limits?.max),
    step: Math.max(1, Math.floor(asNumber(limits?.step) ?? 1)),
    stock: Math.max(0, Math.floor(asNumber(limits?.stock) ?? 0)),
    variantId: asId(record.variantId),
    problem,
  };
}

function normalizeCart(raw: unknown): ServerCart {
  const envelope = asRecord(raw);
  const record = asRecord(envelope?.data) ?? envelope;
  if (!record || !Array.isArray(record.lines)) {
    throw new ApiError('INVALID_RESPONSE', 'We could not load your cart. Please try again.');
  }
  const sessionId = asText(record.sessionId);
  if (sessionId && !getAuthToken()) saveCartSessionId(sessionId);

  const totals = asRecord(record.totals);
  return {
    id: asId(record.id),
    lines: asList(record.lines)
      .map(normalizeLine)
      .filter((line): line is ServerCartLine => line !== null),
    totals: {
      subtotal: asNumber(totals?.subtotal) ?? 0,
      bulkSavings: asNumber(totals?.bulkSavings) ?? 0,
      delivery: asNumber(totals?.delivery) ?? 0,
      tax: asNumber(totals?.tax) ?? 0,
      grandTotal: asNumber(totals?.grandTotal) ?? 0,
    },
    canCheckout: record.canCheckout === true,
  };
}

/** The guest cart key header, sent on every cart request (and checkout) when not signed in. */
export async function cartHeaders(): Promise<Record<string, string>> {
  if (getAuthToken()) return {};
  const id = await loadCartSessionId();
  return id ? { 'x-session-id': id } : {};
}

async function requestCart(): Promise<ServerCart> {
  return normalizeCart(await apiGet('/cart', undefined, { headers: await cartHeaders() }));
}

let guestStart: Promise<ServerCart> | null = null;

/** A guest's first request creates the cart and its key, so only one may run. */
export async function fetchCart(): Promise<ServerCart> {
  if (getAuthToken() || (await loadCartSessionId())) return requestCart();
  guestStart ??= requestCart().finally(() => {
    guestStart = null;
  });
  return guestStart;
}

async function ensureGuestSession() {
  if (!getAuthToken() && !(await loadCartSessionId())) await fetchCart();
}

export async function putCartLine(productId: string, quantity: number, variantId?: string): Promise<ServerCart> {
  await ensureGuestSession();
  return normalizeCart(
    await apiPut(
      `/cart/items/${encodeURIComponent(productId)}`,
      { quantity, ...(variantId ? { variantId: Number(variantId) } : {}) },
      { headers: await cartHeaders() }
    )
  );
}

/** After sign-in: moves this device's guest cart into the account cart. */
export async function mergeGuestCart(): Promise<ServerCart> {
  const sessionId = await loadCartSessionId();
  if (!sessionId) return fetchCart();
  return normalizeCart(await apiPost('/cart/merge', { sessionId }));
}
