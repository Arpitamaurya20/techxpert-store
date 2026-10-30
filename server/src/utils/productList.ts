import { badRequest } from './validate.js';

/** Portal and older app builds: the full row, up to 200 per page. */
export const FULL_LIMIT_MAX = 200;
/** Phone lists (`view=card`): a screen never needs more than this. */
export const CARD_LIMIT_MAX = 60;
/** Shortest search the card view accepts. Below this the API answers 400. */
export const SEARCH_MIN_LENGTH = 2;

export type ProductListView = 'full' | 'card';

export interface ProductListOptions {
  view: ProductListView;
  /** false skips the COUNT query; the answer carries `hasMore` instead of `total`. */
  includeTotal: boolean;
  /** Keyset cursor: only products with an id above this. Card view only. */
  after?: number;
}

function single(value: unknown): string | undefined {
  if (Array.isArray(value)) return value.length ? String(value[0]) : undefined;
  return value === undefined || value === null ? undefined : String(value);
}

/**
 * Read `view`, `total` and `after` from the query string.
 * Nothing here changes the default answer: without `view=card` the caller gets exactly what it got before.
 */
export function parseProductListOptions(query: Record<string, unknown>): ProductListOptions {
  const rawView = single(query.view)?.trim().toLowerCase();
  if (rawView !== undefined && rawView !== '' && rawView !== 'card' && rawView !== 'full') {
    badRequest("view must be 'card' or 'full'");
  }
  const view: ProductListView = rawView === 'card' ? 'card' : 'full';

  const rawTotal = single(query.total)?.trim().toLowerCase();
  if (rawTotal !== undefined && rawTotal !== '' && !['true', 'false', '1', '0'].includes(rawTotal)) {
    badRequest("total must be 'true' or 'false'");
  }
  const includeTotal = !(rawTotal === 'false' || rawTotal === '0');

  const rawAfter = single(query.after)?.trim();
  let after: number | undefined;
  if (rawAfter !== undefined && rawAfter !== '') {
    if (view !== 'card') badRequest('after needs view=card');
    const n = Number(rawAfter);
    if (!Number.isInteger(n) || n < 0) badRequest('after must be a product id');
    after = n;
  }

  return { view, includeTotal, ...(after !== undefined ? { after } : {}) };
}

/** Card view only: refuse a search shorter than the minimum. Returns the trimmed text. */
export function cardSearchTerm(search: unknown): string | undefined {
  if (search === undefined || search === null) return undefined;
  const text = String(search).trim();
  if (!text) return undefined;
  if (text.length < SEARCH_MIN_LENGTH) {
    badRequest(`Type at least ${SEARCH_MIN_LENGTH} characters to search.`);
  }
  return text;
}

/** Make `%` and `_` typed by a customer match themselves instead of acting as wildcards. */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, '\\$&');
}

/**
 * The card query asks for one row more than the page. If it arrived, there is another page:
 * drop it and report where to continue.
 */
export function trimCardPage<T extends { id: number | string }>(
  rows: T[],
  limit: number
): { rows: T[]; hasMore: boolean; nextAfter: number | null } {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  return { rows: page, hasMore, nextAfter: hasMore && last ? Number(last.id) : null };
}
