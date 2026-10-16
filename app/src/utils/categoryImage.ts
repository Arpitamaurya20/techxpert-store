import type { ImageSourcePropType } from 'react-native';

/**
 * Local unbranded catalogue photos for Home tiles. Used only when the
 * category has no `imageUrl` from the API. These are generic still-lifes,
 * not brand partnerships or live product photographs.
 */
const LOCAL_BY_ID: Record<string, ImageSourcePropType> = {
  'cement-plaster': require('../../assets/images/categories/cement.jpg'),
  'tiling-grouts': require('../../assets/images/categories/grout.jpg'),
  'paints-putty': require('../../assets/images/categories/paint.jpg'),
  'plywood-mdf': require('../../assets/images/categories/plywood.jpg'),
  'adhesives-sealants': require('../../assets/images/categories/adhesive.jpg'),
  'electricals-lighting': require('../../assets/images/categories/electrical.jpg'),
  'plumbing-supplies': require('../../assets/images/categories/plumbing.jpg'),
  'bath-sanitary': require('../../assets/images/categories/bath.jpg'),
};

export function getLocalCategoryImage(categoryId: string): ImageSourcePropType | undefined {
  return LOCAL_BY_ID[categoryId];
}
