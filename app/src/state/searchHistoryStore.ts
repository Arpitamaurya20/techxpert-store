import { createPersistentStore, parseStringList } from './createPersistentStore';

const MAX_SEARCHES = 6;

/** The customer's recent product searches, newest first. Saved on this device only. */
const searchHistoryStore = createPersistentStore<string[]>('techxpert.recentSearches', [], parseStringList);

export function addRecentSearch(query: string) {
  const text = query.trim();
  if (!text) return;
  searchHistoryStore.setState((items) =>
    [text, ...items.filter((item) => item.toLowerCase() !== text.toLowerCase())].slice(0, MAX_SEARCHES)
  );
}

export function clearRecentSearches() {
  searchHistoryStore.setState([]);
}

export function useRecentSearches() {
  return searchHistoryStore.useStore((items) => items);
}
