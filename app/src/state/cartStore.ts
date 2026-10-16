/**
 * In-memory cart shared by Home, listing, details and this Cart tab.
 * There is no cart API yet: items are not saved to a server or across
 * app restarts. When the backend is ready, replace these functions with
 * authenticated calls such as GET/POST/PATCH/DELETE /cart and keep this
 * store as the UI cache. Do not add a second cart.
 */
import type { Product } from '@/types/catalog';

import { createStore } from './createStore';

export type CartItem = {
  productId: string;
  name: string;
  categoryId: string;
  brandName?: string;
  unit?: string;
  imageUrl?: string;
  /** Price when the item was added; the backend must re-check it at checkout. */
  price: number;
  quantity: number;
  minQuantity: number;
  quantityStep: number;
  maxQuantity: number;
};

type CartState = {
  items: CartItem[];
};

export type AddToCartFailure =
  | 'out_of_stock'
  | 'price_unavailable'
  | 'limit_reached'
  | 'invalid_quantity';

export type AddToCartResult =
  | { ok: true; added: number; quantity: number }
  | { ok: false; reason: AddToCartFailure; maxQuantity: number };

/** Used when the backend sends no stock or order limit. */
const DEFAULT_MAX_QUANTITY = 99;

export const cartStore = createStore<CartState>({ items: [] });

export function getMaxQuantity(product: Product): number {
  if (product.stockStatus === 'out_of_stock') return 0;

  const limits = [product.stockQuantity, product.maxOrderQuantity].filter(
    (limit): limit is number => typeof limit === 'number' && limit >= 0
  );
  return Math.min(DEFAULT_MAX_QUANTITY, ...limits);
}

export type QuantityRules = {
  min: number;
  step: number;
  max: number;
};

export function getQuantityRules(product: Product): QuantityRules {
  return {
    min: product.minOrderQuantity ?? 1,
    step: product.quantityStep ?? 1,
    max: getMaxQuantity(product),
  };
}

/** Range of quantities that can still be added, or null when nothing more can be added. */
export type AddableRange = { min: number; max: number; step: number };

export function getAddableRange(product: Product, quantityInCart: number): AddableRange | null {
  if (product.price === undefined) return null;
  const rules = getQuantityRules(product);
  // The minimum order applies to the first add; after that, quantities grow by the step.
  const min = quantityInCart > 0 ? rules.step : Math.max(rules.min, rules.step);
  const remaining = rules.max - quantityInCart;
  if (remaining < min) return null;
  const max = min + Math.floor((remaining - min) / rules.step) * rules.step;
  return { min, max, step: rules.step };
}

export function isValidAddQuantity(quantity: number, range: AddableRange): boolean {
  return (
    Number.isInteger(quantity) &&
    quantity >= range.min &&
    quantity <= range.max &&
    (quantity - range.min) % range.step === 0
  );
}

export function getCartQuantity(productId: string): number {
  return cartStore.getState().items.find((item) => item.productId === productId)?.quantity ?? 0;
}

/**
 * Adds to the in-memory cart. Without `quantity`, adds the smallest allowed
 * amount (the minimum order for a new item). Invalid quantities are rejected
 * rather than silently changed.
 */
export function addToCart(product: Product, quantity?: number): AddToCartResult {
  const rules = getQuantityRules(product);
  if (rules.max <= 0) return { ok: false, reason: 'out_of_stock', maxQuantity: 0 };
  if (product.price === undefined) {
    return { ok: false, reason: 'price_unavailable', maxQuantity: rules.max };
  }

  const current = getCartQuantity(product.id);
  const range = getAddableRange(product, current);
  if (!range) return { ok: false, reason: 'limit_reached', maxQuantity: rules.max };

  const added = quantity ?? range.min;
  if (!isValidAddQuantity(added, range)) {
    return { ok: false, reason: 'invalid_quantity', maxQuantity: rules.max };
  }

  const price = product.price;
  const nextQuantity = current + added;

  cartStore.setState((state) => {
    const exists = state.items.some((item) => item.productId === product.id);
    const items = exists
      ? state.items.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                quantity: nextQuantity,
                minQuantity: rules.min,
                quantityStep: rules.step,
                maxQuantity: rules.max,
              }
            : item
        )
      : [
          ...state.items,
          {
            productId: product.id,
            name: product.name,
            categoryId: product.categoryId,
            brandName: product.brandName,
            unit: product.unit,
            imageUrl: product.imageUrl,
            price,
            quantity: nextQuantity,
            minQuantity: rules.min,
            quantityStep: rules.step,
            maxQuantity: rules.max,
          },
        ];
    return { items };
  });

  return { ok: true, added, quantity: nextQuantity };
}

/** Keeps a cart quantity inside the item's limits and on its quantity step. */
function fitCartQuantity(quantity: number, item: CartItem): number {
  const low = Math.max(item.minQuantity, item.quantityStep);
  const stepped = low + Math.round((quantity - low) / item.quantityStep) * item.quantityStep;
  const highest = low + Math.floor((item.maxQuantity - low) / item.quantityStep) * item.quantityStep;
  return Math.max(low, Math.min(stepped, highest));
}

export function setCartQuantity(productId: string, quantity: number) {
  cartStore.setState((state) => ({
    items: state.items.map((item) =>
      item.productId === productId ? { ...item, quantity: fitCartQuantity(quantity, item) } : item
    ),
  }));
}

export function removeFromCart(productId: string) {
  cartStore.setState((state) => ({
    items: state.items.filter((item) => item.productId !== productId),
  }));
}

export function useCartItems() {
  return cartStore.useStore((state) => state.items);
}

/** Total number of units in the cart, shown on the header icon and Cart tab. */
export function useCartCount() {
  return cartStore.useStore((state) => state.items.reduce((sum, item) => sum + item.quantity, 0));
}

/** Number of distinct products, used as the cart screen subtitle. */
export function useCartLineCount() {
  return cartStore.useStore((state) => state.items.length);
}

/** Smallest quantity the − control may reach; going lower uses Remove. */
export function getCartQuantityFloor(item: Pick<CartItem, 'minQuantity' | 'quantityStep'>): number {
  return Math.max(item.minQuantity, item.quantityStep);
}

export function useCartQuantity(productId: string) {
  return cartStore.useStore(
    (state) => state.items.find((item) => item.productId === productId)?.quantity ?? 0
  );
}
