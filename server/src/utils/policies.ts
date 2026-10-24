import { badRequest } from './validate.js';

export const POLICY_IDS = ['privacy', 'terms', 'cancellation', 'shipping'] as const;
export type PolicyId = (typeof POLICY_IDS)[number];

export const POLICY_TITLES: Record<PolicyId, string> = {
  privacy: 'Privacy policy',
  terms: 'Terms & Conditions',
  cancellation: 'Cancellation & Refunds',
  shipping: 'Shipping & Delivery',
};

export const LAST_UPDATED_MAX = 40;
export const SOURCE_URL_MAX = 300;
export const INTRO_MAX = 6;
export const SECTION_MAX = 24;
export const HEADING_MAX = 120;
export const BLOCK_MAX = 16;
export const PARAGRAPH_MAX = 800;
export const BULLET_MAX = 20;
export const BULLET_TEXT_MAX = 400;

export type PolicyBlock = string | string[];
export type PolicySection = { heading: string; blocks: PolicyBlock[] };
export type PolicyInput = {
  id: PolicyId;
  title: string;
  lastUpdated: string;
  sourceUrl: string;
  intro: string[];
  sections: PolicySection[];
};

function oneLine(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

export function policyId(value: unknown): PolicyId {
  const id = typeof value === 'string' ? value : '';
  if (!(POLICY_IDS as readonly string[]).includes(id)) {
    badRequest('Choose privacy, terms, cancellation, or shipping.');
  }
  return id as PolicyId;
}

/**
 * One policy staff can save. intro and sections must both be sent, so an empty
 * body cannot clear the page by accident. Sending both as empty lists does clear it.
 * A blank paragraph or bullet is left out.
 */
export function validatePolicyBody(id: unknown, body: unknown): PolicyInput {
  const policy = policyId(id);
  const source = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  if (!Array.isArray(source.intro)) badRequest('intro must be a list.');
  if (!Array.isArray(source.sections)) badRequest('sections must be a list.');
  if (source.intro.length > INTRO_MAX) badRequest('A policy holds 6 opening paragraphs.');
  if (source.sections.length > SECTION_MAX) badRequest('A policy holds 24 sections.');

  const intro: string[] = [];
  for (const raw of source.intro) {
    const paragraph = oneLine(raw);
    if (!paragraph) continue;
    if (paragraph.length > PARAGRAPH_MAX) badRequest('A paragraph is 800 characters or less.');
    intro.push(paragraph);
  }

  const sections: PolicySection[] = [];
  const headings = new Set<string>();
  for (const raw of source.sections) {
    if (!raw || typeof raw !== 'object') badRequest('Each section needs a heading.');
    const item = raw as Record<string, unknown>;
    const heading = oneLine(item.heading);
    if (!Array.isArray(item.blocks)) badRequest('Each section needs a list of paragraphs.');
    if (item.blocks.length > BLOCK_MAX) badRequest('A section holds 16 paragraphs.');
    const blocks: PolicyBlock[] = [];
    for (const block of item.blocks) {
      if (typeof block === 'string') {
        const paragraph = oneLine(block);
        if (!paragraph) continue;
        if (paragraph.length > PARAGRAPH_MAX) badRequest('A paragraph is 800 characters or less.');
        blocks.push(paragraph);
        continue;
      }
      if (!Array.isArray(block)) badRequest('A paragraph is words, or a list of points.');
      if (block.length > BULLET_MAX) badRequest('A list holds 20 points.');
      const bullets: string[] = [];
      for (const bullet of block) {
        const text = oneLine(bullet);
        if (!text) continue;
        if (text.length > BULLET_TEXT_MAX) badRequest('A point is 400 characters or less.');
        bullets.push(text);
      }
      if (bullets.length) blocks.push(bullets);
    }
    if (!heading && blocks.length === 0) continue;
    if (!heading) badRequest('Each section needs a heading.');
    if (blocks.length === 0) badRequest('Each section needs a paragraph.');
    const key = heading.toLowerCase();
    if (headings.has(key)) badRequest('Each section can appear only once.');
    headings.add(key);
    sections.push({ heading, blocks });
  }

  const published = intro.length > 0 || sections.length > 0;
  const lastUpdated = published ? oneLine(source.lastUpdated) : '';
  const sourceUrl = published ? oneLine(source.sourceUrl) : '';
  if (lastUpdated.length > LAST_UPDATED_MAX) badRequest('The updated date is 40 characters or less.');
  if (sourceUrl.length > SOURCE_URL_MAX) badRequest('The website link is 300 characters or less.');
  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) badRequest('The website link must start with https://.');

  return {
    id: policy,
    title: POLICY_TITLES[policy],
    lastUpdated,
    sourceUrl,
    intro,
    sections,
  };
}
