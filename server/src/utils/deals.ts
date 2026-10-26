import { assertHttpOrPathUrl, badRequest } from './validate.js';

/** Two tiles fill the deals row. */
export const DEAL_MAX = 2;
export const DEAL_TONES = ['peach', 'navy'] as const;
export type DealTone = (typeof DEAL_TONES)[number];

export type DealInput = {
  categoryId: number;
  title: string;
  highlight: string;
  tagline: string;
  tone: DealTone;
  imageUrl: string;
};

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function categoryId(value: unknown): number {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) badRequest('Each tile needs a category.');
  return n;
}

function imageAddress(value: string): string {
  if (!value) return '';
  if (value.length > 1000) badRequest('An image address must be 1000 characters or less.');
  try {
    return assertHttpOrPathUrl(value, 'image');
  } catch {
    badRequest('Enter an image address starting with http or /, or leave it blank.');
  }
}

/**
 * The deals row staff can save. Leaving `deals` out is refused, so an empty body
 * cannot clear the row. An empty list does clear it.
 */
export function validateDealsBody(body: unknown): DealInput[] {
  const source = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  if (!Array.isArray(source.deals)) badRequest('deals must be a list.');
  if (source.deals.length > DEAL_MAX) badRequest('The deals row holds 2 tiles.');
  const seen = new Set<number>();
  const deals: DealInput[] = [];
  for (const raw of source.deals) {
    if (!raw || typeof raw !== 'object') badRequest('Each tile needs a category and a title.');
    const item = raw as Record<string, unknown>;
    const title = text(item.title);
    const highlight = text(item.highlight);
    const tagline = text(item.tagline);
    const imageUrl = text(item.imageUrl);
    const tone = text(item.tone);
    const hasCategory = item.categoryId !== undefined && item.categoryId !== '' && item.categoryId !== null;
    if (!hasCategory && !title && !highlight && !tagline && !imageUrl) continue;
    const id = categoryId(item.categoryId);
    if (!title) badRequest('Each tile needs a title.');
    if (title.length > 32) badRequest('A tile title is 32 characters or less.');
    if (highlight.length > 24) badRequest('The second line is 24 characters or less.');
    if (tagline.length > 60) badRequest('The tagline is 60 characters or less.');
    if (!(DEAL_TONES as readonly string[]).includes(tone)) badRequest('Each tile is peach or navy.');
    if (seen.has(id)) badRequest('Each tile needs a different category.');
    seen.add(id);
    deals.push({
      categoryId: id,
      title,
      highlight,
      tagline,
      tone: tone as DealTone,
      imageUrl: imageAddress(imageUrl),
    });
  }
  return deals;
}
