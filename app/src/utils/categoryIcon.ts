import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

import { DEMO_CATEGORIES } from '@/data/demoCategories';

export type MaterialIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const FALLBACK_ICON: MaterialIconName = 'package-variant-closed';

const iconByCategoryId = new Map(DEMO_CATEGORIES.map((category) => [category.id, category.icon]));

function isIconName(name: string | undefined): name is MaterialIconName {
  return !!name && name in MaterialCommunityIcons.glyphMap;
}

/** Picks a display icon for a category, falling back to a generic box when unknown. */
export function getCategoryIcon(categoryId?: string, icon?: string): MaterialIconName {
  if (isIconName(icon)) return icon;
  const mapped = categoryId ? iconByCategoryId.get(categoryId) : undefined;
  return isIconName(mapped) ? mapped : FALLBACK_ICON;
}
