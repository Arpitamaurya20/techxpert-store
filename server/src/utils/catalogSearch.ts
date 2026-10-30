/** Store catalog search helpers: synonyms, ranking, bigram typo help. */

/** Small curated map. Keys and values are lower-case. */
export const SEARCH_SYNONYMS: Record<string, string[]> = {
  fan: ['ceiling fan', 'exhaust fan', 'bladeless'],
  bulb: ['led', 'lamp', 'light'],
  led: ['bulb', 'lamp'],
  mcb: ['breaker', 'circuit breaker'],
  breaker: ['mcb', 'circuit breaker'],
  wire: ['cable', 'wiring'],
  cable: ['wire', 'wiring'],
  switch: ['socket', 'modular'],
  socket: ['switch', 'plug'],
  ac: ['air conditioner', 'air cooler'],
  invertor: ['inverter'],
  inverter: ['invertor'],
};

export function normalizeSearchQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/** Expand a query with synonyms (unique, lower-case phrases). */
export function expandSearchTerms(query: string): string[] {
  const q = normalizeSearchQuery(query).toLowerCase();
  if (!q) return [];
  const terms = new Set<string>([q]);
  const words = q.split(' ');
  for (const word of words) {
    const extras = SEARCH_SYNONYMS[word];
    if (extras) for (const e of extras) terms.add(e);
  }
  const whole = SEARCH_SYNONYMS[q];
  if (whole) for (const e of whole) terms.add(e);
  return [...terms];
}

/** Words for a relaxed any-word fallback (length ≥ 2). */
export function searchWords(query: string): string[] {
  return normalizeSearchQuery(query)
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2);
}

export function bigrams(text: string): Set<string> {
  const t = text.toLowerCase().replace(/\s+/g, '');
  const out = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}

/** Dice coefficient on character bigrams. 0..1 */
export function bigramScore(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter += 1;
  return (2 * inter) / (A.size + B.size);
}

/** Best bigram matches above a floor, capped. */
export function typoSuggestions(
  query: string,
  candidates: { id: string | number; name: string }[],
  limit = 3,
  floor = 0.35
): { id: string | number; name: string; score: number }[] {
  const q = normalizeSearchQuery(query);
  if (q.length < 2) return [];
  return candidates
    .map((c) => ({ ...c, score: bigramScore(q, c.name) }))
    .filter((c) => c.score >= floor)
    .sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name)))
    .slice(0, limit);
}

/**
 * Boolean FULLTEXT query for MariaDB/MySQL (prefix on each token).
 * Returns null when the query is too short for useful FULLTEXT.
 */
export function fulltextBooleanQuery(query: string): string | null {
  const words = searchWords(query).filter((w) => w.length >= 3);
  if (!words.length) return null;
  return words.map((w) => `+${w.replace(/[+\-><()~*"@]+/g, '')}*`).filter((w) => w.length > 2).join(' ');
}
