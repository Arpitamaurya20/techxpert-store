import type { Product } from '@/types/catalog';

export type ProductSort = 'default' | 'price_asc' | 'price_desc' | 'name_asc' | 'newest';

/** "Default order" is the order the catalogue returns; it makes no personalised or "recommended" claim. */
export const SORT_LABELS: Record<ProductSort, string> = {
  default: 'Default order',
  price_asc: 'Price: Low to High',
  price_desc: 'Price: High to Low',
  name_asc: 'Name: A to Z',
  newest: 'Newest First',
};

export type ProductFilters = {
  /** Brand ids (or names when the backend sends no id). */
  brands: string[];
  minPrice?: number;
  maxPrice?: number;
  inStockOnly: boolean;
};

export const EMPTY_FILTERS: ProductFilters = { brands: [], inStockOnly: false };

export type BrandOption = { key: string; name: string };

export type FilterOptions = {
  brands: BrandOption[];
  priceRange: { min: number; max: number } | null;
  /** Availability filtering is offered only when the catalogue sends stock data. */
  hasStockInfo: boolean;
};

const nameCollator = new Intl.Collator('en-IN', { sensitivity: 'base', numeric: true });

function brandKey(product: Product) {
  return product.brandId ?? product.brandName;
}

/** Products without a price go last in both price orders. */
function comparePrices(a: Product, b: Product, direction: 1 | -1) {
  if (a.price === undefined || b.price === undefined) {
    if (a.price === b.price) return nameCollator.compare(a.name, b.name);
    return a.price === undefined ? 1 : -1;
  }
  return (a.price - b.price) * direction || nameCollator.compare(a.name, b.name);
}

/** Sort options that the loaded data can honestly support. */
export function getAvailableSorts(products: Product[]): ProductSort[] {
  const sorts: ProductSort[] = ['default', 'price_asc', 'price_desc', 'name_asc'];
  if (products.length > 0 && products.every((product) => product.createdAt)) sorts.push('newest');
  return sorts;
}

export function sortProducts(products: Product[], sort: ProductSort): Product[] {
  if (sort === 'default') return products;
  const sorted = [...products];
  switch (sort) {
    case 'price_asc':
      return sorted.sort((a, b) => comparePrices(a, b, 1));
    case 'price_desc':
      return sorted.sort((a, b) => comparePrices(a, b, -1));
    case 'name_asc':
      return sorted.sort((a, b) => nameCollator.compare(a.name, b.name));
    case 'newest':
      return sorted.sort((a, b) => Date.parse(b.createdAt ?? '') - Date.parse(a.createdAt ?? ''));
  }
}

/** Builds filter choices only from data that actually exists in the loaded products. */
export function getFilterOptions(products: Product[]): FilterOptions {
  const brands = new Map<string, string>();
  let min = Infinity;
  let max = -Infinity;

  for (const product of products) {
    const key = brandKey(product);
    if (key && product.brandName) brands.set(key, product.brandName);
    if (product.price !== undefined) {
      min = Math.min(min, product.price);
      max = Math.max(max, product.price);
    }
  }

  return {
    brands: [...brands]
      .map(([key, name]) => ({ key, name }))
      .sort((a, b) => nameCollator.compare(a.name, b.name)),
    priceRange: Number.isFinite(min) ? { min: Math.floor(min), max: Math.ceil(max) } : null,
    hasStockInfo: products.some((product) => product.stockStatus !== undefined),
  };
}

export function applyFilters(products: Product[], filters: ProductFilters): Product[] {
  return products.filter((product) => {
    if (filters.brands.length > 0) {
      const key = brandKey(product);
      if (!key || !filters.brands.includes(key)) return false;
    }
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      if (product.price === undefined) return false;
      if (filters.minPrice !== undefined && product.price < filters.minPrice) return false;
      if (filters.maxPrice !== undefined && product.price > filters.maxPrice) return false;
    }
    // Products without confirmed stock are excluded rather than assumed available.
    if (filters.inStockOnly && product.stockStatus !== 'in_stock' && product.stockStatus !== 'low_stock') {
      return false;
    }
    return true;
  });
}

export function countActiveFilters(filters: ProductFilters): number {
  return (
    filters.brands.length +
    (filters.minPrice !== undefined || filters.maxPrice !== undefined ? 1 : 0) +
    (filters.inStockOnly ? 1 : 0)
  );
}
