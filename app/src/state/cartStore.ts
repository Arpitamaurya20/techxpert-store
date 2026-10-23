/**
 * The cart shared by Home, listing, details and the Cart tab.
 *
 * With a server configured, the server owns the cart (see `services/cartApi.ts`)
 * and this store is its on-screen copy: a change shows at once, is sent for that
 * line (one request at a time, newest quantity wins) and the server's reply
 * replaces the copy. A refused change goes back to the server's quantity and
 * leaves a `notice` for `CartSync` to show. Without a server the cart lives in
 * memory only. Do not add a second cart.
 */
import { isApiConfigured } from '@/services/apiConfig';
import { getErrorMessage } from '@/services/apiClient';
import {
  fetchCart,
  mergeGuestCart,
  putCartLine,
  type CartLineProblem,
  type CartTotals,
  type ServerCart,
  type ServerCartLine,
} from '@/services/cartApi';
import type { Product } from '@/types/catalog';

import { createStore } from './createStore';

export type CartItem = {
  productId: string;
  name: string;
  categoryId: string;
  brandName?: string;
  unit?: string;
  imageUrl?: string;
  /** Price per unit after any bulk tier; from the server once it has priced the line. */
  price: number;
  quantity: number;
  minQuantity: number;
  quantityStep: number;
  maxQuantity: number;
  tierLabel?: string;
  problem?: CartLineProblem;
  /** Most that can be ordered now (stock and order limit), from the server. */
  orderableQuantity?: number;
};

export type { CartLineProblem, CartTotals };

type CartState = {
  /** The server cart this copy came from; checkout places the order from it. */
  cartId: string | null;
  items: CartItem[];
  /** Server totals; null without a server or while a change is still being saved. */
  totals: CartTotals | null;
  canCheckout: boolean;
  notice: { id: number; message: string } | null;
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

export const cartStore = createStore<CartState>({
  cartId: null,
  items: [],
  totals: null,
  canCheckout: !isApiConfigured,
  notice: null,
});

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

// --- Server sync -----------------------------------------------------------

/** Quantities waiting to be sent, and lines with a request in flight. */
const wanted = new Map<string, number>();
const inFlight = new Set<string>();
let noticeId = 0;

const isBusy = (productId: string) => wanted.has(productId) || inFlight.has(productId);

function postNotice(message: string) {
  noticeId += 1;
  cartStore.setState((state) => ({ ...state, notice: { id: noticeId, message } }));
}

function fromServerLine(line: ServerCartLine, local: CartItem | undefined): CartItem {
  const caps = [DEFAULT_MAX_QUANTITY, line.stock, line.max].filter(
    (limit): limit is number => typeof limit === 'number'
  );
  const orderable = Math.min(...caps);
  return {
    productId: line.productId,
    name: line.name,
    categoryId: line.categoryId || local?.categoryId || '',
    brandName: line.brandName ?? local?.brandName,
    unit: line.unit ?? local?.unit,
    imageUrl: line.imageUrl ?? local?.imageUrl,
    price: line.unitPrice ?? line.basePrice ?? local?.price ?? 0,
    quantity: line.quantity,
    minQuantity: line.min,
    quantityStep: local?.quantityStep ?? 1,
    maxQuantity: Math.max(line.quantity, orderable),
    tierLabel: line.tierLabel,
    problem: line.problem,
    orderableQuantity: orderable,
  };
}

/** Takes the server's cart, except lines the customer is still changing. */
function applyServerCart(cart: ServerCart) {
  cartStore.setState((state) => {
    const local = new Map(state.items.map((item) => [item.productId, item]));
    const items: CartItem[] = [];
    const seen = new Set<string>();
    for (const line of cart.lines) {
      seen.add(line.productId);
      if (!isBusy(line.productId)) items.push(fromServerLine(line, local.get(line.productId)));
      else if (local.has(line.productId)) items.push(local.get(line.productId)!);
    }
    for (const item of state.items) {
      if (!seen.has(item.productId) && isBusy(item.productId)) items.push(item);
    }
    const settled = wanted.size === 0 && inFlight.size === 0;
    return {
      ...state,
      cartId: cart.id ?? state.cartId,
      items,
      totals: settled ? cart.totals : null,
      canCheckout: settled && cart.canCheckout,
    };
  });
}

async function syncLine(productId: string) {
  if (inFlight.has(productId) || !wanted.has(productId)) return;
  const quantity = wanted.get(productId)!;
  wanted.delete(productId);
  inFlight.add(productId);
  try {
    const cart = await putCartLine(productId, quantity);
    inFlight.delete(productId);
    applyServerCart(cart);
  } catch (error) {
    inFlight.delete(productId);
    postNotice(getErrorMessage(error));
    await refreshCart();
  } finally {
    if (wanted.has(productId)) void syncLine(productId);
  }
}

function sendLine(productId: string, quantity: number) {
  if (!isApiConfigured) return;
  wanted.set(productId, quantity);
  cartStore.setState((state) => ({ ...state, totals: null, canCheckout: false }));
  void syncLine(productId);
}

/** Loads the server cart (app start, sign-out, after a refused change). */
export async function refreshCart() {
  if (!isApiConfigured) return;
  try {
    applyServerCart(await fetchCart());
  } catch {
    // Keep what is on screen; the next change or screen visit tries again.
  }
}

/** After sign-in: the guest cart on this device joins the account cart. */
export async function mergeCartIntoAccount() {
  if (!isApiConfigured) return;
  try {
    applyServerCart(await mergeGuestCart());
  } catch (error) {
    postNotice(getErrorMessage(error));
    await refreshCart();
  }
}

// --- Changes ---------------------------------------------------------------

/**
 * Adds to the cart. Without `quantity`, adds the smallest allowed amount (the
 * minimum order for a new item). Invalid quantities are rejected rather than
 * silently changed; the server checks again.
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
    return { ...state, items };
  });
  sendLine(product.id, nextQuantity);

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
  const item = cartStore.getState().items.find((entry) => entry.productId === productId);
  if (!item) return;
  const next = fitCartQuantity(quantity, item);
  if (next === item.quantity) return;
  cartStore.setState((state) => ({
    ...state,
    items: state.items.map((entry) => (entry.productId === productId ? { ...entry, quantity: next } : entry)),
  }));
  sendLine(productId, next);
}

export function removeFromCart(productId: string) {
  cartStore.setState((state) => ({
    ...state,
    items: state.items.filter((item) => item.productId !== productId),
  }));
  sendLine(productId, 0);
}

/**
 * Empties the cart on screen once the order is placed. The server already closed the cart that
 * became the order, so this only loads the customer's new, empty cart.
 */
export function clearCart() {
  wanted.clear();
  cartStore.setState((state) => ({ ...state, cartId: null, items: [], totals: null, canCheckout: !isApiConfigured }));
  void refreshCart();
}

/** The cart number and total checkout sends, or null while a change is still being saved. */
export function getCheckoutCart(): { cartId: string | null; grandTotal: number } | null {
  const { cartId, totals, canCheckout } = cartStore.getState();
  return totals && canCheckout ? { cartId, grandTotal: totals.grandTotal } : null;
}

// --- Reading ---------------------------------------------------------------

export function useCartItems() {
  return cartStore.useStore((state) => state.items);
}

export function useCartTotals() {
  return cartStore.useStore((state) => state.totals);
}

/** False while a change is being saved or a line has a problem. Always true without a server. */
export function useCanCheckout() {
  return cartStore.useStore((state) => state.canCheckout);
}

export function useCartNotice() {
  return cartStore.useStore((state) => state.notice);
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
