import { badRequest } from './validate.js';

/** Short points under the product name. */
export const HIGHLIGHT_MAX = 8;
/** Name-and-value rows in the specifications table. */
export const SPEC_MAX = 16;

export type ProductSpecification = { label: string; value: string };

export type ProductPageUpdate = {
  highlights?: string[];
  specifications?: ProductSpecification[];
};

function oneLine(value: unknown, max: number, message: string): string {
  if (typeof value !== 'string') badRequest(message);
  const text = value.trim().replace(/\s+/g, ' ');
  if (!text || text.length > max) badRequest(message);
  return text;
}

/**
 * Highlights and specifications sent with a product save.
 * A list left out is not being edited. An empty list clears that part of the page.
 */
export function productPageUpdates(body: unknown): ProductPageUpdate {
  if (!body || typeof body !== 'object') return {};
  const record = body as Record<string, unknown>;
  const next: ProductPageUpdate = {};

  if (record.highlights !== undefined) {
    if (!Array.isArray(record.highlights)) badRequest('highlights must be a list.');
    const lines = record.highlights
      .map((item) => (typeof item === 'string' ? item.trim().replace(/\s+/g, ' ') : item))
      .filter((item) => item !== '');
    if (lines.length > HIGHLIGHT_MAX) badRequest('A product can have up to 8 highlights.');
    next.highlights = lines.map((item) => oneLine(item, 160, 'Each highlight is 160 characters or less.'));
  }

  if (record.specifications !== undefined) {
    if (!Array.isArray(record.specifications)) badRequest('specifications must be a list.');
    const rows = record.specifications.filter((item) => {
      if (!item || typeof item !== 'object') return true;
      const row = item as Record<string, unknown>;
      const label = typeof row.label === 'string' ? row.label.trim() : row.label;
      const value = typeof row.value === 'string' ? row.value.trim() : row.value;
      return label !== '' || value !== '';
    });
    if (rows.length > SPEC_MAX) badRequest('A product can have up to 16 specifications.');
    next.specifications = rows.map((item) => {
      if (!item || typeof item !== 'object') badRequest('Each specification needs a name and a value.');
      const row = item as Record<string, unknown>;
      return {
        label: oneLine(row.label, 80, 'Each specification needs a name and a value.'),
        value: oneLine(row.value, 160, 'Each specification needs a name and a value.'),
      };
    });
  }

  return next;
}
