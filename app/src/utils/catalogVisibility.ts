import type { Category } from '@/types/catalog';

/**
 * Customer UI only surfaces categories that have priced products to sell.
 * The Store API sends `productCount: 0` for empty shelves (e.g. Electrical Appliances).
 * When count is omitted (demo / older payloads), keep the category visible.
 */
export function isSellableCategory(category: Category): boolean {
  return category.productCount === undefined || category.productCount > 0;
}

export function sellableCategories(categories: Category[]): Category[] {
  return categories.filter(isSellableCategory);
}
