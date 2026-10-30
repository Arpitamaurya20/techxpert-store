import { createTtlCache } from './ttlCache.js';

const CATEGORIES_TTL_MS = 60_000;
const BRANDS_TTL_MS = 60_000;
const HOME_BOOT_TTL_MS = 60_000;

export const categoriesCache = createTtlCache<any[]>(CATEGORIES_TTL_MS);
export const brandsCache = createTtlCache<any[]>(BRANDS_TTL_MS);
export const homeBootCache = createTtlCache<Record<string, unknown>>(HOME_BOOT_TTL_MS);

/** Category or product changes can move counts on both lists. */
export function invalidateCatalogListCaches() {
  categoriesCache.clear();
  brandsCache.clear();
  homeBootCache.clear();
}

/** CMS home content changed; keep catalog caches. */
export function invalidateHomeBootCache() {
  homeBootCache.clear();
}

/** Public list Cache-Control used on categories, brands and home-boot. */
export const PUBLIC_LIST_CACHE_CONTROL = 'public, max-age=30, stale-while-revalidate=120';
