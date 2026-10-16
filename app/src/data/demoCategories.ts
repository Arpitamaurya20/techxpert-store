import type { Category } from '@/types/catalog';

/**
 * DEMO DATA — proposed categories only, not confirmed live inventory.
 * Used only while EXPO_PUBLIC_API_BASE_URL is not set. The real list must
 * come from the backend (`GET /catalog/categories`).
 */
export const DEMO_CATEGORIES: Category[] = [
  { id: 'cement-plaster', name: 'Cement & Plaster', icon: 'wall' },
  { id: 'tiling-grouts', name: 'Tiling & Grouts', icon: 'texture-box' },
  { id: 'paints-putty', name: 'Paints & Putty', icon: 'format-paint' },
  { id: 'plywood-mdf', name: 'Plywood & MDF', icon: 'layers-outline' },
  { id: 'adhesives-sealants', name: 'Adhesives & Sealants', icon: 'bottle-tonic-outline' },
  { id: 'electricals-lighting', name: 'Electricals & Lighting', icon: 'lightbulb-on-outline' },
  { id: 'bath-sanitary', name: 'Bath & Sanitary', icon: 'shower-head' },
  { id: 'furniture-fittings', name: 'Furniture Fittings', icon: 'cupboard-outline' },
  { id: 'locks-handles', name: 'Locks & Handles', icon: 'lock-outline' },
  { id: 'plumbing-supplies', name: 'Plumbing Supplies', icon: 'pipe' },
  { id: 'waterproofing', name: 'Waterproofing', icon: 'umbrella-outline' },
  { id: 'tools-accessories', name: 'Tools & Accessories', icon: 'hammer-wrench' },
  { id: 'safety-equipment', name: 'Safety Equipment', icon: 'hard-hat' },
];
