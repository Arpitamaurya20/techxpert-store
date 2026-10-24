import { badRequest } from './validate.js';

/** One row of chips under the home search box. */
export const SUGGESTION_MAX = 8;
export const PHRASE_MAX = 40;

/**
 * The search ideas staff can save. A missing list is refused, so an empty
 * body cannot wipe the row by accident. An empty list clears it. Blank
 * ideas are left out.
 */
export function validateSearchSuggestions(body: unknown): string[] {
  const source = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  if (!Array.isArray(source.suggestions)) badRequest('suggestions must be a list.');

  const cleaned: string[] = [];
  const seen = new Set<string>();
  for (const raw of source.suggestions) {
    if (typeof raw !== 'string') badRequest('Each search idea must be words.');
    const phrase = raw.trim().replace(/\s+/g, ' ');
    if (!phrase) continue;
    if (phrase.length > PHRASE_MAX) badRequest('Each search idea is 40 characters or less.');
    const key = phrase.toLowerCase();
    if (seen.has(key)) badRequest('Each search idea can appear only once.');
    seen.add(key);
    cleaned.push(phrase);
  }
  if (cleaned.length > SUGGESTION_MAX) badRequest('You can show up to 8 search ideas.');
  return cleaned;
}
