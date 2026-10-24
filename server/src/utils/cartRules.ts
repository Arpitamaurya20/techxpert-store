import { randomBytes } from 'node:crypto';

export type CartLimits = { min: number; max: number | null; stock: number };
export type LineProblem = 'out_of_stock' | 'price_unavailable' | 'over_limit' | null;
export type CartTotals = {
  subtotal: number;
  bulkSavings: number;
  delivery: number;
  tax: number;
  grandTotal: number;
};

export const TAX_RATE = 0.18;
export const FREE_DELIVERY_FROM = 2000;
export const DELIVERY_CHARGE = 99;

const money = (value: number) => Math.round(value * 100) / 100;

function wholeOrNull(value: unknown): number | null {
  const n = Number(value);
  return value != null && Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export function lineLimits(row: { minOrderQuantity?: unknown; maxOrderQuantity?: unknown; stock?: unknown }): CartLimits {
  return {
    min: wholeOrNull(row.minOrderQuantity) ?? 1,
    max: wholeOrNull(row.maxOrderQuantity),
    stock: wholeOrNull(row.stock) ?? 0,
  };
}

function hasPrice(price: unknown): boolean {
  const n = Number(price);
  return price != null && Number.isFinite(n) && n > 0;
}

/** Why this quantity cannot be put in the cart, or null when it can. */
export function quantityRefusal(name: string, quantity: number, limits: CartLimits, price: unknown): string | null {
  if (!Number.isInteger(quantity) || quantity < 1) return 'Quantity must be a whole number of at least 1.';
  if (!hasPrice(price)) return `"${name}" is not available to order right now.`;
  if (limits.stock <= 0) return `"${name}" is out of stock.`;
  if (quantity < limits.min) return `"${name}" must be ordered in quantities of at least ${limits.min}.`;
  if (limits.max != null && quantity > limits.max) return `You can order up to ${limits.max} of "${name}".`;
  if (quantity > limits.stock) return `Only ${limits.stock} of "${name}" are in stock.`;
  return null;
}

export type ReorderTarget = { setTo: number; note: string | null } | { reason: string };

/**
 * Where one ordered product should land in the cart. Adds the ordered quantity on top of
 * what is already there, and stops at the most that can be bought today. A note explains
 * a smaller result. A reason means the line was not changed.
 */
export function reorderTarget(
  name: string,
  ordered: number,
  already: number,
  limits: CartLimits,
  price: unknown
): ReorderTarget {
  const orderedQty = Math.floor(Number(ordered));
  if (!Number.isInteger(orderedQty) || orderedQty < 1) {
    return { reason: `"${name}" has no quantity to add.` };
  }
  const blocked = quantityRefusal(name, limits.min, limits, price);
  if (blocked) return { reason: blocked };

  const cap = Math.min(limits.max ?? limits.stock, limits.stock);
  if (already >= cap) return { reason: `You already have the most of "${name}" you can order.` };

  const wanted = already + orderedQty;
  const setTo = Math.min(Math.max(wanted, limits.min), cap);
  const note = setTo === wanted ? null : quantityRefusal(name, wanted, limits, price);
  return { setTo, note };
}

/** Why a line already in the cart cannot be checked out as it is. */
export function lineProblem(quantity: number, limits: CartLimits, price: unknown): LineProblem {
  if (!hasPrice(price)) return 'price_unavailable';
  if (limits.stock <= 0) return 'out_of_stock';
  if (quantity > limits.stock || (limits.max != null && quantity > limits.max)) return 'over_limit';
  return null;
}

/** Guest and account carts both hold the product: keep the larger, not the sum. */
export function mergeQuantity(account: number | undefined, guest: number | undefined, limits: CartLimits): number {
  const wanted = Math.max(account ?? 0, guest ?? 0);
  const cap = Math.min(limits.max ?? Infinity, limits.stock);
  return cap >= limits.min ? Math.min(wanted, cap) : wanted;
}

export type BulkPrice = { unitPrice: unknown; totalSavings: unknown; appliedTier: unknown };

export type LinePrice = {
  basePrice: number | null;
  unitPrice: number | null;
  appliedTier: unknown;
  lineTotal: number;
  savings: number;
  problem: LineProblem;
};

/**
 * One line's price as the Cart screen and checkout both charge it. `bulk` is the bulk-tier
 * result for this quantity and base price; it is ignored when the product has no price.
 */
export function priceLine(quantity: number, limits: CartLimits, price: unknown, bulk: BulkPrice | null): LinePrice {
  const problem = lineProblem(quantity, limits, price);
  if (!hasPrice(price)) {
    return { basePrice: null, unitPrice: null, appliedTier: null, lineTotal: 0, savings: 0, problem };
  }
  const basePrice = Number(price);
  const unitPrice = bulk ? Number(bulk.unitPrice) : basePrice;
  return {
    basePrice,
    unitPrice,
    appliedTier: bulk?.appliedTier ?? null,
    lineTotal: money(unitPrice * quantity),
    savings: money(Number(bulk?.totalSavings) || 0),
    problem,
  };
}

/** True when two rupee amounts are the same to the paisa. */
export function sameMoney(a: unknown, b: unknown): boolean {
  const x = Number(a);
  const y = Number(b);
  return Number.isFinite(x) && Number.isFinite(y) && Math.round(x * 100) === Math.round(y * 100);
}

export function cartTotals(lines: { lineTotal: number; savings: number; problem: LineProblem }[]): CartTotals {
  let subtotal = 0;
  let bulkSavings = 0;
  for (const line of lines) {
    if (line.problem) continue;
    subtotal += line.lineTotal;
    bulkSavings += line.savings;
  }
  subtotal = money(subtotal);
  const delivery = subtotal === 0 || subtotal >= FREE_DELIVERY_FROM ? 0 : DELIVERY_CHARGE;
  const tax = money(subtotal * TAX_RATE);
  return {
    subtotal,
    bulkSavings: money(bulkSavings),
    delivery,
    tax,
    grandTotal: money(subtotal + delivery + tax),
  };
}

export function newSessionId(): string {
  return randomBytes(32).toString('hex');
}

/** Guest cart keys are server-issued; anything short or unusual is ignored. */
export function isUsableSessionId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(value);
}
