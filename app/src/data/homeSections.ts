import type { ProductQuery } from '@/types/catalog';

export type HomeProductSectionConfig = {
  /** Unique key; also used to cache the section's request. */
  id: string;
  title: string;
  /** Which products the section shows: featured items, or one category by its id. */
  query: Pick<ProductQuery, 'featured' | 'categoryId' | 'brandId'>;
};

/**
 * Product sections on Home, top to bottom. To add a section, add a row here
 * with the category id its products belong to (see `demoCategories.ts` or
 * the backend's category list). Products appear automatically once they are
 * in that category.
 */
export const HOME_PRODUCT_SECTIONS: HomeProductSectionConfig[] = [
  { id: 'featured', title: 'Featured Products', query: { featured: true } },
  { id: 'cement-plaster', title: 'Cement & Plaster', query: { categoryId: 'cement-plaster' } },
  { id: 'tiling-grouts', title: 'Tiling & Grouts', query: { categoryId: 'tiling-grouts' } },
  { id: 'paints-putty', title: 'Paints & Putty', query: { categoryId: 'paints-putty' } },
  { id: 'plywood-mdf', title: 'Plywood & MDF', query: { categoryId: 'plywood-mdf' } },
  { id: 'adhesives-sealants', title: 'Fevicol & Adhesives', query: { categoryId: 'adhesives-sealants' } },
  { id: 'electricals-lighting', title: 'Electricals & Lights', query: { categoryId: 'electricals-lighting' } },
  { id: 'bath-sanitary', title: 'Bath Fittings & Sanitaryware', query: { categoryId: 'bath-sanitary' } },
  {
    id: 'furniture-fittings',
    title: 'Furniture Fittings & Accessories',
    query: { categoryId: 'furniture-fittings' },
  },
  { id: 'locks-handles', title: 'Locks & Handles', query: { categoryId: 'locks-handles' } },
  { id: 'tools-accessories', title: 'Hardware & Tools', query: { categoryId: 'tools-accessories' } },
  { id: 'plumbing-supplies', title: 'Plumbing Pipes & Fittings', query: { categoryId: 'plumbing-supplies' } },
  {
    id: 'waterproofing',
    title: 'Waterproofing & Repairing Chemicals',
    query: { categoryId: 'waterproofing' },
  },
];

/** Products shown per section before "See All". */
export const HOME_SECTION_LIMIT = 4;
