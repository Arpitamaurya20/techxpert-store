import { orderRefusal } from './checkoutPricing.js';

/** The price stays put once the order is being prepared, delivered, or cancelled, and on an app order that is already confirmed. */
export const PRICE_LOCKED =
  'The price can be changed on a pending order, or on an order staff placed, before it is being prepared.';

const PRICE_CAP = 9999999.99;

export type AgreedLine = {
  id: number;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
};

export type AgreedChange = {
  delivery?: number;
  lines: { itemId: number; unitPrice: number }[];
};

const money = (value: number) => Math.round(value * 100) / 100;

/** Tax on the line is stored as a percent (18) or, rarely, as a fraction (0.18). */
export function taxFraction(rate: unknown): number {
  const n = Number(rate);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n > 1 ? n / 100 : n;
}

/** Pending orders, and orders staff placed, until someone starts preparing them. */
export function priceChangeAllowed(status: unknown, source: unknown): boolean {
  const state = String(status || '');
  if (state === 'pending') return true;
  if (state !== 'confirmed') return false;
  return source === 'staff' || source === 'request';
}

function rupees(value: unknown, label: string): number {
  const n = Number(value);
  if (typeof value === 'boolean' || !Number.isFinite(n) || money(n) < 0 || money(n) > PRICE_CAP) {
    throw orderRefusal(400, `Enter ${label} in rupees, from ₹0 up to ₹99,99,999.99.`);
  }
  return money(n);
}

/** The delivery charge, a line price, or both. Anything else in the body is ignored. */
export function readAgreedChange(body: unknown): AgreedChange {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw orderRefusal(400, 'Say the delivery charge or a line price to change.');
  }
  const raw = body as Record<string, unknown>;
  const change: AgreedChange = { lines: [] };
  if (raw.delivery !== undefined) change.delivery = rupees(raw.delivery, 'the delivery charge');
  if (raw.lines !== undefined) {
    if (!Array.isArray(raw.lines) || raw.lines.length < 1 || raw.lines.length > 30) {
      throw orderRefusal(400, 'Name the lines to reprice, up to 30.');
    }
    const seen = new Set<number>();
    for (const row of raw.lines) {
      if (!row || typeof row !== 'object') throw orderRefusal(400, 'Enter the line price in rupees.');
      const item = row as Record<string, unknown>;
      const itemId = Number(item.itemId);
      if (!Number.isInteger(itemId) || itemId <= 0) throw orderRefusal(400, 'Each line needs its item number.');
      if (seen.has(itemId)) throw orderRefusal(400, 'Each line is named once.');
      seen.add(itemId);
      change.lines.push({ itemId, unitPrice: rupees(item.unitPrice, 'the line price') });
    }
  }
  if (change.delivery === undefined && change.lines.length === 0) {
    throw orderRefusal(400, 'Say the delivery charge or a line price to change.');
  }
  return change;
}

const rupee = (n: number) => `₹${n.toFixed(2)}`;

/**
 * Applies the agreed delivery charge and line prices. Tax is worked out again on a changed line.
 * An agreed line price replaces that line's bulk savings. Stock is not touched.
 */
export function applyAgreedPrice(lines: AgreedLine[], delivery: number, change: AgreedChange) {
  const byId = new Map(lines.map((line) => [line.id, line]));
  for (const row of change.lines) {
    if (!byId.has(row.itemId)) throw orderRefusal(409, 'That line is not on this order.');
  }
  const nextDelivery = change.delivery ?? money(delivery);
  const phrases: string[] = [];
  if (change.delivery !== undefined && change.delivery !== money(delivery)) {
    phrases.push(`delivery ${rupee(money(delivery))} to ${rupee(change.delivery)}`);
  }

  const nextLines = lines.map((line) => {
    const agreed = change.lines.find((row) => row.itemId === line.id);
    if (!agreed || agreed.unitPrice === money(line.unitPrice)) {
      return { ...line, touched: false };
    }
    const lineTotal = money(agreed.unitPrice * line.quantity);
    phrases.push(`line price ${rupee(money(line.unitPrice))} to ${rupee(agreed.unitPrice)}`);
    return {
      ...line,
      unitPrice: agreed.unitPrice,
      lineTotal,
      taxAmount: money(lineTotal * taxFraction(line.taxRate)),
      discountAmount: 0,
      touched: true,
    };
  });

  const subtotal = money(nextLines.reduce((sum, line) => sum + line.lineTotal, 0));
  const tax = money(nextLines.reduce((sum, line) => sum + line.taxAmount, 0));
  const discount = money(nextLines.reduce((sum, line) => sum + line.discountAmount, 0));
  return {
    lines: nextLines,
    delivery: nextDelivery,
    subtotal,
    tax,
    discount,
    grandTotal: money(subtotal + nextDelivery + tax),
    changed: phrases.length > 0,
    note: phrases.join('. '),
  };
}
