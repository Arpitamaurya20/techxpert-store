/** The most products one customer, or one guest session, can save. */
export const WISHLIST_MAX = 100;

export type SavedAvailability = {
  price: number | null;
  stockQuantity: number;
  stockStatus: 'in_stock' | 'out_of_stock';
  available: boolean;
  unavailableReason: string | null;
};

/** Whether a saved product can be bought today. Same three reasons as Order Again. */
export function savedAvailability(active: boolean, price: unknown, stock: unknown): SavedAvailability {
  const priced = price != null && Number.isFinite(Number(price)) && Number(price) > 0 ? Number(price) : null;
  const stockQuantity = Number.isFinite(Number(stock)) && Number(stock) > 0 ? Math.floor(Number(stock)) : 0;
  let unavailableReason: string | null = null;
  if (!active) unavailableReason = 'This product is no longer sold.';
  else if (priced == null) unavailableReason = "This product isn't available to order right now.";
  else if (stockQuantity <= 0) unavailableReason = 'This product is out of stock.';
  return {
    price: priced,
    stockQuantity,
    stockStatus: stockQuantity > 0 ? 'in_stock' : 'out_of_stock',
    available: unavailableReason == null,
    unavailableReason,
  };
}

/** Whole product ids from a device list. Junk is ignored. Stops at the cap. */
export function savedProductIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const ids: number[] = [];
  for (const item of value) {
    const n = Number(item);
    if (!Number.isInteger(n) || n <= 0) continue;
    ids.push(n);
    if (ids.length >= WISHLIST_MAX) break;
  }
  return ids;
}

/**
 * One list, newest first: what was just saved on the device, then the guest session, then the account.
 * Duplicates are dropped. Anything past the cap is the oldest, and is left out.
 */
export function mergeSavedIds(accountNewestFirst: number[], guestNewestFirst: number[], deviceNewestFirst: number[]): number[] {
  const seen = new Set<number>();
  const merged: number[] = [];
  for (const id of [...deviceNewestFirst, ...guestNewestFirst, ...accountNewestFirst]) {
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    merged.push(id);
    if (merged.length >= WISHLIST_MAX) break;
  }
  return merged;
}
