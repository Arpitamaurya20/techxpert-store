import { orderRefusal } from './checkoutPricing.js';

const money = (value: number) => `₹${(Math.round(value * 100) / 100).toFixed(2)}`;

const clip = (value: string, max: number) => (value.length <= max ? value : value.slice(0, max));

/** What staff see for an order the customer placed. No name and no phone. */
export function orderAlert(input: { orderNumber: string; status: string; grandTotal: number }): {
  headline: string;
  detail: string;
} {
  const waiting = input.status === 'pending';
  return {
    headline: clip(String(input.orderNumber || 'Order'), 80),
    detail: clip(
      waiting ? `Waiting for confirmation. ${money(input.grandTotal)}. The goods are held.` : `Confirmed. ${money(input.grandTotal)}.`,
      200
    ),
  };
}

/** What staff see for a Talk to us request. Nothing was ordered. No name and no phone. */
export function requestAlert(input: { id: number; lineCount: number; grandTotal: number }): {
  headline: string;
  detail: string;
} {
  const lines = input.lineCount === 1 ? '1 line' : `${input.lineCount} lines`;
  return {
    headline: clip(`Talk to us ${input.id}`, 80),
    detail: clip(`${lines}, ${money(input.grandTotal)}. Nothing is ordered.`, 200),
  };
}

/** Marking an alert seen is the only change this call accepts. */
export function readAlertSeen(body: unknown): void {
  if (!body || typeof body !== 'object' || Array.isArray(body) || (body as { seen?: unknown }).seen !== true) {
    throw orderRefusal(400, 'Say that you have seen it.');
  }
}
