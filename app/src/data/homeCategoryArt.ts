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

/** Keyword → local photo so live API ids (e.g. "13") still get a picture. */
const ART_BY_NAME: { match: RegExp; art: ImageSourcePropType }[] = [
  { match: /cement|plaster|gypsum/i, art: HOME_CATEGORY_ART['cement-plaster'] },
  { match: /tile|grout|tiling/i, art: HOME_CATEGORY_ART['tiling-grouts'] },
  { match: /paint|putty|primer|emulsion/i, art: HOME_CATEGORY_ART['paints-putty'] },
  { match: /plywood|mdf|laminate|board/i, art: HOME_CATEGORY_ART['plywood-mdf'] },
  { match: /adhesive|sealant|epoxy/i, art: HOME_CATEGORY_ART['adhesives-sealants'] },
  { match: /electr|light|wire|switch|ev\b|charg/i, art: HOME_CATEGORY_ART['electricals-lighting'] },
  { match: /bath|sanitar|faucet|tap/i, art: HOME_CATEGORY_ART['bath-sanitary'] },
  { match: /furniture|fitting|hinge|handle/i, art: HOME_CATEGORY_ART['furniture-fittings'] },
  { match: /lock|bolt/i, art: HOME_CATEGORY_ART['locks-handles'] },
  { match: /plumb|pipe|valve|cpvc|pvc/i, art: HOME_CATEGORY_ART['plumbing-supplies'] },
  { match: /waterproof/i, art: HOME_CATEGORY_ART.waterproofing },
  { match: /tool|drill|hammer/i, art: HOME_CATEGORY_ART['tools-accessories'] },
  { match: /safety|helmet|glove/i, art: HOME_CATEGORY_ART['safety-equipment'] },
  { match: /industrial|automat|sensor|relay/i, art: HOME_CATEGORY_ART['electricals-lighting'] },
];

const FALLBACK_ART = HOME_CATEGORY_ART['tools-accessories'];

export function getHomeCategoryArt(categoryId: string): ImageSourcePropType | undefined {
  return HOME_CATEGORY_ART[categoryId];
}

/** Local photo for a category by id or name (live catalogue ids included). */
export function resolveHomeCategoryArt(categoryId?: string, name?: string): ImageSourcePropType {
  if (categoryId && HOME_CATEGORY_ART[categoryId]) return HOME_CATEGORY_ART[categoryId];
  const haystack = `${categoryId ?? ''} ${name ?? ''}`;
  for (const entry of ART_BY_NAME) {
    if (entry.match.test(haystack)) return entry.art;
  }
  return FALLBACK_ART;
}
