import type { Product, Subcategory } from '@/types/catalog';

/**
 * Whether a product belongs under a product type. Uses the backend's
 * `subcategoryId` when the product has one; otherwise every word of the
 * type's search term must appear in the product name or unit.
 */
export function matchesSubcategory(product: Product, subcategory: Subcategory): boolean {
  if (product.subcategoryId) return product.subcategoryId === subcategory.id;
  const haystack = [product.name, product.unit].filter(Boolean).join(' ').toLowerCase();
  return (subcategory.searchTerm ?? subcategory.name)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}
