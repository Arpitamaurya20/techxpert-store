import type { Product } from '@/types/catalog';

/**
 * SAMPLE DATA — ratings, MRPs and key features for demo products only.
 * These are placeholders to preview the product page layout; the screen
 * labels them "Sample" and never applies them to products from the API.
 */

const SAMPLE_HIGHLIGHTS: Record<string, string[]> = {
  'cement-plaster': ['High strength & durability', 'Longer life', 'Suitable for all construction works', 'Trusted brand'],
  'tiling-grouts': ['Strong bond', 'Water resistant', 'Easy to apply', 'Low wastage'],
  'paints-putty': ['Smooth finish', 'Long-lasting colour', 'Low odour', 'Easy to clean'],
  'plywood-mdf': ['Termite resistant', 'Uniform thickness', 'Easy to cut and finish', 'Long life'],
  'adhesives-sealants': ['Strong hold', 'Water resistant', 'Easy to apply', 'Quick setting'],
  'electricals-lighting': ['Energy efficient', 'Safe and insulated', 'Long life', 'Easy installation'],
  'bath-sanitary': ['Rust resistant', 'Easy to clean', 'Durable finish', 'Easy installation'],
  'furniture-fittings': ['Smooth operation', 'Corrosion resistant', 'Durable build', 'Easy installation'],
  'locks-handles': ['Durable build', 'Corrosion resistant', 'Smooth operation', 'Secure locking'],
  'plumbing-supplies': ['Leak-proof joints', 'Corrosion resistant', 'Long life', 'Easy installation'],
  waterproofing: ['Long-lasting protection', 'Crack bridging', 'Easy to apply', 'Weather resistant'],
  'tools-accessories': ['Durable build', 'Comfortable grip', 'Precise results', 'Long life'],
  'safety-equipment': ['Comfortable fit', 'Durable material', 'Reliable protection', 'Easy to use'],
};

function hash(text: string) {
  let value = 0;
  for (let index = 0; index < text.length; index += 1) {
    value = (value * 31 + text.charCodeAt(index)) >>> 0;
  }
  return value;
}

export function withSampleExtras(product: Product): Product {
  const seed = hash(product.id);
  const discount = 5 + (seed % 11);
  const originalPrice =
    product.price !== undefined && product.originalPrice === undefined
      ? Math.ceil(product.price / (1 - discount / 100) / 10) * 10
      : product.originalPrice;

  return {
    ...product,
    rating: product.rating ?? 4.2 + ((seed >>> 4) % 7) / 10,
    reviewCount: product.reviewCount ?? 40 + ((seed >>> 8) % 200),
    originalPrice: originalPrice !== undefined && product.price !== undefined && originalPrice > product.price
      ? originalPrice
      : undefined,
    highlights: product.highlights ?? SAMPLE_HIGHLIGHTS[product.categoryId],
  };
}
