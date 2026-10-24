/** Why staff can't move an order from `current` to `next`, or null when they can. */
export function statusChangeRefusal(current: string, next: string): string | null {
  if (current === 'cancelled') return 'This order is already cancelled, and a cancelled order stays cancelled.';
  if (current === 'delivered' && next === 'cancelled') {
    return "A delivered order can't be cancelled. Taking goods back is a return, which the portal doesn't handle.";
  }
  return null;
}

/**
 * Only orders placed through this shop took stock at checkout (`OrderService.writeOrder` numbers them `TX-ORD-`).
 * Imported orders may never have, so cancelling them puts nothing back.
 */
export function restocksOnCancel(orderNumber: unknown): boolean {
  return typeof orderNumber === 'string' && orderNumber.startsWith('TX-ORD-');
}

/** How many products the Order Again rail asks for, and the most it may ask for. */
export const ORDER_AGAIN_LIMIT = 10;
export const ORDER_AGAIN_MAX = 20;

export type OrderAgainSource = {
  productId: number;
  name: string;
  sku: string | null;
  imageUrl: string | null;
  categoryId: number | null;
  unit: string;
  /** The product row is still on sale. A missing or switched-off product is not. */
  active: boolean;
  price: number | null;
  variantId: number | null;
  variantName?: string | null;
  /** False when the bought option is gone or switched off. Left out means it is still on sale. */
  variantLive?: boolean;
  stockQuantity: number;
  minOrderQuantity: number;
  /** 1 means any whole number from the minimum. */
  quantityStep?: number;
  lastQuantity: number;
  lastOrderedAt: string;
};

export type OrderAgainItem = {
  productId: number;
  variantId: number | null;
  variantName: string | null;
  name: string;
  sku: string | null;
  imageUrl: string | null;
  categoryId: number | null;
  unit: string;
  /** Today's selling price. Null when the product has none; never the price from the old order. */
  price: number | null;
  stockQuantity: number;
  stockStatus: 'in_stock' | 'out_of_stock';
  minOrderQuantity: number;
  quantityStep: number;
  lastQuantity: number;
  lastOrderedAt: string;
  available: boolean;
  unavailableReason: string | null;
};

/** A whole limit inside 1..max, otherwise the default. */
export function orderAgainLimit(asked: unknown): number {
  const n = Number(asked);
  if (!Number.isInteger(n) || n < 1) return ORDER_AGAIN_LIMIT;
  return Math.min(n, ORDER_AGAIN_MAX);
}

/**
 * One product the customer bought, priced and stocked as it is today.
 * Unavailable products stay in the list so the app can label them; they are never dropped or swapped.
 */
export function orderAgainItem(row: OrderAgainSource): OrderAgainItem {
  const price = row.price != null && Number.isFinite(row.price) && row.price > 0 ? row.price : null;
  const stockQuantity = Number.isFinite(row.stockQuantity) && row.stockQuantity > 0 ? Math.floor(row.stockQuantity) : 0;
  const variantLive = row.variantLive !== false;
  let unavailableReason: string | null = null;
  if (!row.active) unavailableReason = 'This product is no longer sold.';
  else if (!variantLive) unavailableReason = "This option isn't available to order right now.";
  else if (price == null) unavailableReason = "This product isn't available to order right now.";
  else if (stockQuantity <= 0) unavailableReason = 'This product is out of stock.';

  return {
    productId: row.productId,
    variantId: row.variantId,
    variantName: row.variantName ? String(row.variantName) : null,
    name: row.name,
    sku: row.sku,
    imageUrl: row.imageUrl,
    categoryId: row.categoryId,
    unit: row.unit || 'unit',
    price,
    stockQuantity,
    stockStatus: stockQuantity > 0 ? 'in_stock' : 'out_of_stock',
    minOrderQuantity: row.minOrderQuantity > 0 ? Math.floor(row.minOrderQuantity) : 1,
    quantityStep: row.quantityStep != null && row.quantityStep > 0 ? Math.floor(row.quantityStep) : 1,
    lastQuantity: row.lastQuantity > 0 ? Math.floor(row.lastQuantity) : 1,
    lastOrderedAt: row.lastOrderedAt,
    available: unavailableReason == null,
    unavailableReason,
  };
}
