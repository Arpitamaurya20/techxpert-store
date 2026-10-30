import { CatalogService } from './catalogService.js';
import { CmsService } from './cmsService.js';
import { DealService } from './dealService.js';
import { HomeMerchService } from './homeMerchService.js';
import { SearchSuggestionService } from './searchSuggestionService.js';
import { TrustClaimService } from './trustClaimService.js';
import { homeBootCache } from '../utils/responseCache.js';

/**
 * One payload for the phone home screen (except Order Again, which needs a sign-in).
 * Cached ~60 s in this process; staff writes clear the cache.
 */
export async function getHomeBoot() {
  const hit = homeBootCache.get();
  if (hit) return hit;

  const [sections, home, searchSuggestions, trust, banners, deals, featured, categories] =
    await Promise.all([
      CmsService.getSections({ audience: 'customer' }),
      HomeMerchService.get(),
      SearchSuggestionService.get(),
      TrustClaimService.get(),
      CmsService.getBanners(undefined, { audience: 'customer' }),
      DealService.get(),
      CatalogService.getProducts({
        featured: true,
        limit: 10,
        pricedOnly: true,
        view: 'card',
        includeTotal: false,
      }),
      CatalogService.getCategories(),
    ]);

  const payload = {
    sections,
    home,
    searchSuggestions,
    trust,
    banners,
    deals: deals.deals,
    featured: featured.products,
    categories,
  };
  homeBootCache.set(payload);
  return payload;
}
