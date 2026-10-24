import { badRequest } from './validate.js';

/**
 * Selling price of the joined variant `pv`. A variant with no price of its own
 * uses the product's lowest active price, which is what the shop charges today.
 */
export const VARIANT_SELLING_PRICE = `COALESCE(
  (SELECT MIN(pr.SellingPrice) FROM product_pricing pr WHERE pr.VariantID = pv.ID AND pr.IsActive = 1),
  (SELECT MIN(pr.SellingPrice) FROM product_pricing pr WHERE pr.ProductID = p.ID AND pr.IsActive = 1)
)`;

export type VariantStockInput = { id: number; stockQuantity: number };

function wholeId(value: unknown, message: string): number {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) badRequest(message);
  return n;
}

/**
 * The option a cart call asked for. Left out means the product's first option,
 * which is what the app sells until it sends one.
 */
export function chosenVariantId(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  return wholeId(value, 'variantId must be a variant number.');
}

/** Stock edits for each option. Left out means the caller is not editing options. */
export function variantStockUpdates(value: unknown): VariantStockInput[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) badRequest('variants must be a list.');
  const seen = new Set<number>();
  return value.map((row) => {
    if (!row || typeof row !== 'object') badRequest('Each option needs a stock quantity.');
    const item = row as Record<string, unknown>;
    const id = wholeId(item.id, 'Each option needs a variant number.');
    if (seen.has(id)) badRequest('Each option is listed once.');
    seen.add(id);
    const stock = typeof item.stockQuantity === 'string' ? Number(item.stockQuantity) : item.stockQuantity;
    if (typeof stock !== 'number' || !Number.isInteger(stock) || stock < 0) {
      badRequest('Enter a whole number of 0 or more for each option.');
    }
    return { id, stockQuantity: stock };
  });
}
