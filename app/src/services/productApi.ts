import { DEMO_BRANDS } from '@/data/demoBrands';
import { DEMO_CATEGORIES } from '@/data/demoCategories';
import { DEMO_PRODUCTS } from '@/data/demoProducts';
import { DEMO_SUBCATEGORIES } from '@/data/demoSubcategories';
import type {
  Brand,
  CatalogResult,
  Category,
  Product,
  ProductQuery,
  ProductSpecification,
  StockStatus,
  Subcategory,
} from '@/types/catalog';

import { ApiError, apiGet } from './apiClient';
import { isApiConfigured } from './apiConfig';
import { asId, asNumber, asRecord, asText, normalizeList } from './normalize';

/**
 * Store catalogue service.
 *
 * When `EXPO_PUBLIC_API_BASE_URL` is set, every function calls the real API
 * and API failures are shown as errors (never silently replaced by demo
 * data). When it is not set, the clearly labelled demo data in `src/data/`
 * is returned with `source: 'demo'` so screens can show a "Sample data" notice.
 *
 * Endpoints the backend needs to provide (all GET, JSON; list endpoints may
 * return either an array or `{ "data": [...] }`):
 *
 *   /catalog/categories
 *       → [{ id, name, slug?, imageUrl?, description?, productCount?, featured? }]
 *         `featured: true` marks categories the business wants under
 *         "Popular Categories"; leave it out rather than guessing.
 *   /catalog/subcategories
 *       → [{ id, categoryId, name, imageUrl?, searchTerm? }]
 *         Product types shown under each category on the Categories tab.
 *         A tile opens the parent category's products searched by
 *         `searchTerm` (or `name` when it is left out).
 *   /catalog/products?search=&categoryId=&brandId=&featured=true&limit=
 *       → [{ id, name, categoryId, categoryName?, subcategoryId?, brandId?, brandName?, imageUrl?,
 *            price, originalPrice?, unit?, stockStatus?, stockQuantity?,
 *            maxOrderQuantity?, description?, featured?, createdAt? }]
 *         Returned in the store's default display order. `brandName` may also
 *         be sent as `brand` (a string or `{ id, name }`). `createdAt` is an
 *         ISO date. The app sorts and filters this list on the device, so the
 *         endpoint should return the complete result for the query; if the
 *         catalogue grows large, add `page`/`pageSize` and `sort` parameters
 *         and move sorting to the server.
 *   /catalog/products/{id}
 *       → a single product, or `{ "data": product }` (404 when it does not exist).
 *         Same fields as the list, plus the details-only fields:
 *           sku?            (or productCode)
 *           images?         extra photo URLs, strings or `{ url }`
 *           specifications? `[{ label, value }]` or `{ "Material": "Brass", ... }`
 *           minOrderQuantity?, quantityStep?, maxOrderQuantity?   whole numbers
 *           shareUrl?       public product page URL (enables Share)
 *         `price` may be left out when a product has no published price;
 *         the app then shows "Price unavailable" and blocks Add to Cart.
 *   /catalog/brands
 *       → [{ id, name, logoUrl? }]   (brands actually stocked in the catalogue)
 *
 * `stockStatus` is one of "in_stock" | "low_stock" | "out_of_stock". Prices
 * are in rupees. `originalPrice` should only be sent when it is a verified MRP.
 */

const STOCK_STATUSES: StockStatus[] = ['in_stock', 'low_stock', 'out_of_stock'];

function normalizeCategory(raw: unknown): Category | null {
  const record = asRecord(raw);
  const id = asId(record?.id);
  const name = asText(record?.name);
  if (!record || !id || !name) return null;
  const productCount = asNumber(record.productCount);
  return {
    id,
    name,
    slug: asText(record.slug),
    imageUrl: asText(record.imageUrl),
    description: asText(record.description),
    productCount: productCount !== undefined ? Math.floor(productCount) : undefined,
    featured: record.featured === true,
  };
}

function normalizeSubcategory(raw: unknown): Subcategory | null {
  const record = asRecord(raw);
  const id = asId(record?.id);
  const categoryId = asId(record?.categoryId);
  const name = asText(record?.name);
  if (!record || !id || !categoryId || !name) return null;
  return {
    id,
    categoryId,
    name,
    imageUrl: asText(record.imageUrl),
    searchTerm: asText(record.searchTerm),
  };
}

function normalizeBrand(raw: unknown): Brand | null {
  const record = asRecord(raw);
  const id = asId(record?.id);
  const name = asText(record?.name);
  if (!record || !id || !name) return null;
  return { id, name, logoUrl: asText(record.logoUrl) };
}

/** Whole quantities of at least 1, e.g. minimum order or step; anything else is ignored. */
function asCount(value: unknown): number | undefined {
  const parsed = asNumber(value);
  return parsed !== undefined && parsed >= 1 ? Math.floor(parsed) : undefined;
}

function asWebUrl(value: unknown): string | undefined {
  const text = asText(value);
  return text && /^https?:\/\/\S+$/i.test(text) ? text : undefined;
}

function asImageList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asText(item) ?? asText(asRecord(item)?.url) ?? asText(asRecord(item)?.imageUrl))
    .filter((url): url is string => url !== undefined);
}

function asSpecValue(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return asText(value);
}

/** Accepts `[{ label|name|key, value }]` or a plain `{ label: value }` object. */
function asSpecifications(value: unknown): ProductSpecification[] {
  const entries: [unknown, unknown][] = Array.isArray(value)
    ? value.map((item) => {
        const record = asRecord(item);
        return [record?.label ?? record?.name ?? record?.key, record?.value];
      })
    : Object.entries(asRecord(value) ?? {});

  return entries
    .map(([label, specValue]) => ({ label: asText(label), value: asSpecValue(specValue) }))
    .filter((spec): spec is ProductSpecification => !!spec.label && !!spec.value);
}

function normalizeProduct(raw: unknown): Product | null {
  const record = asRecord(raw);
  const id = asId(record?.id);
  const name = asText(record?.name);
  if (!record || !id || !name) return null;

  const price = asNumber(record.price);
  const originalPrice = asNumber(record.originalPrice ?? record.mrp);
  const stockStatus = STOCK_STATUSES.find((status) => status === record.stockStatus);
  const stockQuantity = asNumber(record.stockQuantity);
  const brand = asRecord(record.brand);
  const createdAt = asText(record.createdAt);
  const gallery = [asText(record.imageUrl), ...asImageList(record.images)].filter(
    (url, index, list): url is string => url !== undefined && list.indexOf(url) === index
  );
  const specifications = asSpecifications(record.specifications ?? record.attributes);

  return {
    id,
    name,
    price,
    categoryId: asId(record.categoryId) ?? '',
    categoryName: asText(record.categoryName),
    subcategoryId: asId(record.subcategoryId),
    brandId: asId(record.brandId) ?? asId(brand?.id),
    brandName: asText(record.brandName) ?? asText(record.brand) ?? asText(brand?.name),
    sku: asText(record.sku) ?? asId(record.sku) ?? asText(record.productCode),
    imageUrl: gallery[0],
    images: gallery.length > 1 ? gallery.slice(1) : undefined,
    originalPrice:
      price !== undefined && originalPrice !== undefined && originalPrice > price
        ? originalPrice
        : undefined,
    unit: asText(record.unit),
    stockStatus,
    stockQuantity: stockQuantity !== undefined ? Math.floor(stockQuantity) : undefined,
    minOrderQuantity: asCount(record.minOrderQuantity ?? record.minimumOrderQuantity),
    maxOrderQuantity: asCount(record.maxOrderQuantity ?? record.maximumOrderQuantity),
    quantityStep: asCount(record.quantityStep),
    description: asText(record.description),
    specifications: specifications.length > 0 ? specifications : undefined,
    shareUrl: asWebUrl(record.shareUrl ?? record.productUrl ?? record.url),
    featured: record.featured === true,
    createdAt: createdAt && !Number.isNaN(Date.parse(createdAt)) ? createdAt : undefined,
  };
}

const demoCategoryNames = new Map(DEMO_CATEGORIES.map((category) => [category.id, category.name]));

function withDemoCategoryName(product: Product): Product {
  return { ...product, categoryName: demoCategoryNames.get(product.categoryId) };
}

function matchesSearch(product: Product, search: string) {
  const haystack = [product.name, product.unit, product.categoryName, product.brandName]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return search
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

function queryDemoProducts(query: ProductQuery): Product[] {
  let results = DEMO_PRODUCTS.map(withDemoCategoryName);
  if (query.featured) results = results.filter((product) => product.featured);
  if (query.categoryId) results = results.filter((product) => product.categoryId === query.categoryId);
  if (query.brandId) results = results.filter((product) => product.brandId === query.brandId);
  if (query.search?.trim()) results = results.filter((product) => matchesSearch(product, query.search!));
  return query.limit ? results.slice(0, query.limit) : results;
}

let categoriesRequest: Promise<CatalogResult<Category[]>> | null = null;

/**
 * Home and Categories both need the category list, so one successful
 * response is shared for the session. Pass `force` (pull-to-refresh) to
 * fetch again; failed requests are never cached.
 */
export function getCategories(options: { force?: boolean } = {}): Promise<CatalogResult<Category[]>> {
  if (!isApiConfigured) return Promise.resolve({ data: DEMO_CATEGORIES, source: 'demo' });
  if (options.force || !categoriesRequest) {
    const request = apiGet('/catalog/categories').then(
      (raw): CatalogResult<Category[]> => ({
        data: normalizeList(raw, normalizeCategory),
        source: 'api',
      })
    );
    categoriesRequest = request;
    request.catch(() => {
      if (categoriesRequest === request) categoriesRequest = null;
    });
  }
  return categoriesRequest;
}

export async function getProducts(query: ProductQuery = {}): Promise<CatalogResult<Product[]>> {
  if (!isApiConfigured) return { data: queryDemoProducts(query), source: 'demo' };
  const raw = await apiGet('/catalog/products', {
    search: query.search?.trim(),
    categoryId: query.categoryId,
    brandId: query.brandId,
    featured: query.featured ? true : undefined,
    limit: query.limit,
  });
  return { data: normalizeList(raw, normalizeProduct), source: 'api' };
}

export function getFeaturedProducts(limit = 8) {
  return getProducts({ featured: true, limit });
}

/** Resolves to `null` data when the product does not exist. */
export async function getProductById(id: string): Promise<CatalogResult<Product | null>> {
  if (!isApiConfigured) {
    const product = DEMO_PRODUCTS.find((item) => item.id === id);
    return { data: product ? withDemoCategoryName(product) : null, source: 'demo' };
  }
  try {
    const raw = await apiGet(`/catalog/products/${encodeURIComponent(id)}`);
    const record = asRecord(raw);
    return { data: normalizeProduct(record?.data ?? raw), source: 'api' };
  } catch (error) {
    if (error instanceof ApiError && error.code === 'NOT_FOUND') return { data: null, source: 'api' };
    throw error;
  }
}

export async function getSubcategories(): Promise<CatalogResult<Subcategory[]>> {
  if (!isApiConfigured) return { data: DEMO_SUBCATEGORIES, source: 'demo' };
  const raw = await apiGet('/catalog/subcategories');
  return { data: normalizeList(raw, normalizeSubcategory), source: 'api' };
}

export async function getBrands(): Promise<CatalogResult<Brand[]>> {
  if (!isApiConfigured) return { data: DEMO_BRANDS, source: 'demo' };
  const raw = await apiGet('/catalog/brands');
  return { data: normalizeList(raw, normalizeBrand), source: 'api' };
}
