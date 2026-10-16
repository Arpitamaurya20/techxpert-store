import type { ImageSourcePropType } from 'react-native';

/**
 * Local catalogue-style photos for Home and Categories tiles. These are
 * generic product pictures, not brand packaging. When the API sends
 * `imageUrl`, that is used instead.
 */
export const HOME_CATEGORY_ART: Record<string, ImageSourcePropType> = {
  'cement-plaster': require('../../assets/images/categories/cement.jpg'),
  'tiling-grouts': require('../../assets/images/categories/grout.jpg'),
  'paints-putty': require('../../assets/images/categories/paint.jpg'),
  'plywood-mdf': require('../../assets/images/categories/plywood.jpg'),
  'adhesives-sealants': require('../../assets/images/categories/adhesive.jpg'),
  'electricals-lighting': require('../../assets/images/categories/electrical.jpg'),
  'bath-sanitary': require('../../assets/images/categories/bath.jpg'),
  'furniture-fittings': require('../../assets/images/categories/furniture.jpg'),
  'locks-handles': require('../../assets/images/categories/locks.jpg'),
  'plumbing-supplies': require('../../assets/images/categories/plumbing.jpg'),
  waterproofing: require('../../assets/images/categories/waterproof.jpg'),
  'tools-accessories': require('../../assets/images/categories/tools.jpg'),
  'safety-equipment': require('../../assets/images/categories/safety.jpg'),
};

export function getHomeCategoryArt(categoryId: string): ImageSourcePropType | undefined {
  return HOME_CATEGORY_ART[categoryId];
}
