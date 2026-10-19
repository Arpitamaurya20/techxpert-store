import { createPersistentStore, parseStringList } from './createPersistentStore';

/** Saved product ids, newest first. Saved on this device only (not synced to an account). */
const wishlistStore = createPersistentStore<string[]>('techxpert.wishlist', [], parseStringList);

/** Returns true when the product is saved after the toggle. */
export function toggleWishlist(productId: string): boolean {
  const saved = wishlistStore.getState().includes(productId);
  wishlistStore.setState((ids) => (saved ? ids.filter((id) => id !== productId) : [productId, ...ids]));
  return !saved;
}

export function removeFromWishlist(productId: string) {
  wishlistStore.setState((ids) => ids.filter((id) => id !== productId));
}

export function useWishlistIds() {
  return wishlistStore.useStore((ids) => ids);
}

export function useIsWishlisted(productId: string) {
  return wishlistStore.useStore((ids) => ids.includes(productId));
}

export function useWishlistCount() {
  return wishlistStore.useStore((ids) => ids.length);
}
