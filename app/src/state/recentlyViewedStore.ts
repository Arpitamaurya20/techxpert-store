import { createPersistentStore, parseStringList } from './createPersistentStore';

const MAX_RECENT = 12;

/** Product ids the customer opened, newest first. Saved on this device only. */
const recentlyViewedStore = createPersistentStore<string[]>('techxpert.recentlyViewed', [], parseStringList);

export function addRecentlyViewed(productId: string) {
  recentlyViewedStore.setState((ids) =>
    ids[0] === productId ? ids : [productId, ...ids.filter((id) => id !== productId)].slice(0, MAX_RECENT)
  );
}

export function clearRecentlyViewed() {
  recentlyViewedStore.setState([]);
}

export function useRecentlyViewedIds() {
  return recentlyViewedStore.useStore((ids) => ids);
}
