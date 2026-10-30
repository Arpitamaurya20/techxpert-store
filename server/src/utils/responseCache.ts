import { createTtlCache } from './ttlCache.js';

const CATEGORIES_TTL_MS = 60_000;
const BRANDS_TTL_MS = 60_000;
const HOME_BOOT_TTL_MS = 60_000;
const SEARCH_SUGGEST_TTL_MS = 30_000;

export const categoriesCache = createTtlCache<any[]>(CATEGORIES_TTL_MS);
export const brandsCache = createTtlCache<any[]>(BRANDS_TTL_MS);
export const homeBootCache = createTtlCache<Record<string, unknown>>(HOME_BOOT_TTL_MS);

/** Keyed typeahead cache (query → payload). Cleared with catalog list caches. */
const searchSuggestEntries = new Map<string, { value: unknown; expiresAt: number }>();

export function getSearchSuggestCache<T>(key: string): T | undefined {
  const hit = searchSuggestEntries.get(key);
  if (!hit) return undefined;
  if (Date.now() >= hit.expiresAt) {
    searchSuggestEntries.delete(key);
    return undefined;
  }
  return hit.value as T;
}

export function setSearchSuggestCache(key: string, value: unknown) {
  searchSuggestEntries.set(key, { value, expiresAt: Date.now() + SEARCH_SUGGEST_TTL_MS });
  if (searchSuggestEntries.size > 200) {
    const oldest = searchSuggestEntries.keys().next().value;
    if (oldest !== undefined) searchSuggestEntries.delete(oldest);
  }
}

export function clearSearchSuggestCache() {
  searchSuggestEntries.clear();
}

/** Category or product changes can move counts on both lists. */
export function invalidateCatalogListCaches() {
  categoriesCache.clear();
  brandsCache.clear();
  homeBootCache.clear();
  clearSearchSuggestCache();
}

/** CMS home content changed; keep catalog caches. */
export function invalidateHomeBootCache() {
  homeBootCache.clear();
}

/** Public list Cache-Control used on categories, brands and home-boot. */
export const PUBLIC_LIST_CACHE_CONTROL = 'public, max-age=30, stale-while-revalidate=120';
