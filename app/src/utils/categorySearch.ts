import type { Category } from '@/types/catalog';

function normalize(text: string) {
  return text.toLowerCase().replace(/&/g, ' and ').replace(/[-_/]/g, ' ');
}

/** Case-insensitive filter: every word typed must appear in the category name, slug or description. */
export function filterCategories(categories: Category[], query: string): Category[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return categories;

  return categories.filter((category) => {
    const haystack = normalize(
      [category.name, category.slug, category.description].filter(Boolean).join(' ')
    );
    return terms.every((term) => haystack.includes(term));
  });
}
