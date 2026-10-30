import { storePool } from '../db/mysql.js';
import { CatalogService } from './catalogService.js';
import { cardSearchTerm, escapeLike } from '../utils/productList.js';
import { typoSuggestions } from '../utils/catalogSearch.js';
import { resolveCatalogImageUrl } from '../utils/catalogMedia.js';
import {
  clearSearchSuggestCache,
  getSearchSuggestCache,
  setSearchSuggestCache,
} from '../utils/responseCache.js';

export type SearchSuggestResult = {
  categories: { id: number | string; name: string }[];
  brands: { id: string; name: string }[];
  products: any[];
  didYouMean?: {
    categories: { id: number | string; name: string }[];
    brands: { id: string; name: string }[];
  };
};

/**
 * Typeahead: up to 8 hits across categories, brands and products.
 * Requires ≥ 2 characters (same rule as card search).
 */
export class CatalogSearchService {
  static async suggest(rawQuery: unknown, opts?: { pricedOnly?: boolean }): Promise<SearchSuggestResult> {
    const q = cardSearchTerm(rawQuery);
    if (!q) {
      return { categories: [], brands: [], products: [] };
    }

    const cacheKey = `${q.toLowerCase()}|${opts?.pricedOnly === false ? 'all' : 'priced'}`;
    const cached = getSearchSuggestCache<SearchSuggestResult>(cacheKey);
    if (cached) return cached;

    const like = `%${escapeLike(q)}%`;

    const [categoryRows] = await storePool.query<any[]>(
      `SELECT ID as id, CategoryName as name
       FROM categories
       WHERE IsActive = 1 AND CategoryName LIKE ?
       ORDER BY DisplayOrder ASC, ID ASC
       LIMIT 3`,
      [like]
    );

    const [brandRows] = await storePool.query<any[]>(
      `SELECT Brand as id, Brand as name, COUNT(*) as productCount
       FROM products
       WHERE IsActive = 1 AND Brand IS NOT NULL AND Brand != '' AND Brand LIKE ?
       GROUP BY Brand
       ORDER BY productCount DESC
       LIMIT 3`,
      [like]
    );

    const productPage = await CatalogService.getProducts({
      search: q,
      pricedOnly: opts?.pricedOnly !== false,
      view: 'card',
      includeTotal: false,
      limit: 5,
    });
    const products = productPage.products.map((p: any) => ({
      id: p.id,
      name: p.name,
      brandName: p.brandName,
      imageUrl: resolveCatalogImageUrl(p.imageUrl) ?? p.imageUrl ?? '',
      price: p.price,
    }));

    let didYouMean: SearchSuggestResult['didYouMean'];
    if (!categoryRows.length && !brandRows.length && !products.length) {
      const [allCats] = await storePool.query<any[]>(
        `SELECT ID as id, CategoryName as name FROM categories WHERE IsActive = 1`
      );
      const brands = await CatalogService.getBrands();
      const catHints = typoSuggestions(
        q,
        allCats.map((c) => ({ id: c.id, name: String(c.name) })),
        3
      );
      const brandHints = typoSuggestions(
        q,
        brands.map((b: any) => ({ id: String(b.id), name: String(b.name) })),
        3
      );
      if (catHints.length || brandHints.length) {
        didYouMean = {
          categories: catHints.map(({ id, name }) => ({ id, name })),
          brands: brandHints.map(({ id, name }) => ({ id: String(id), name })),
        };
      }
    }

    const payload: SearchSuggestResult = {
      categories: categoryRows.map((c) => ({ id: c.id, name: String(c.name) })),
      brands: brandRows.map((b) => ({ id: String(b.id), name: String(b.name) })),
      products,
      ...(didYouMean ? { didYouMean } : {}),
    };

    setSearchSuggestCache(cacheKey, payload);
    return payload;
  }

  static clearSuggestCache() {
    clearSearchSuggestCache();
  }
}
