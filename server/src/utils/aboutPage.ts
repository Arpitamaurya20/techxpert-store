import { badRequest } from './validate.js';

export const MISSION_TITLE_MAX = 80;
export const MISSION_BODY_MAX = 600;
export const FACT_MAX = 4;
export const FACT_VALUE_MAX = 16;
export const FACT_LABEL_MAX = 32;
export const VALUE_MAX = 6;
export const VALUE_TITLE_MAX = 40;
export const VALUE_BODY_MAX = 240;

/** Ionicons names the About screen can draw. */
export const ABOUT_ICONS = [
  'ribbon-outline',
  'bulb-outline',
  'heart-outline',
  'shield-checkmark-outline',
  'people-outline',
  'leaf-outline',
] as const;

export type AboutIcon = (typeof ABOUT_ICONS)[number];
export type AboutFactInput = { value: string; label: string };
export type AboutValueInput = { icon: AboutIcon; title: string; body: string };
export type AboutInput = {
  missionTitle: string;
  missionBody: string;
  facts: AboutFactInput[];
  values: AboutValueInput[];
};

function oneLine(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

/**
 * The About page staff can save. Saving replaces the whole page.
 * An empty body clears it. A fact or value row that is entirely blank is left out.
 */
export function validateAboutBody(body: unknown): AboutInput {
  const source = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  if (source.facts !== undefined && !Array.isArray(source.facts)) badRequest('facts must be a list.');
  if (source.values !== undefined && !Array.isArray(source.values)) badRequest('values must be a list.');
  const missionTitle = oneLine(source.missionTitle);
  const missionBody = oneLine(source.missionBody);
  if (missionTitle.length > MISSION_TITLE_MAX) badRequest('The mission heading is 80 characters or less.');
  if (missionBody.length > MISSION_BODY_MAX) badRequest('The mission paragraph is 600 characters or less.');

  const rawFacts = Array.isArray(source.facts) ? source.facts : [];
  if (rawFacts.length > FACT_MAX) badRequest('The About page holds 4 facts.');
  const facts: AboutFactInput[] = [];
  const factNames = new Set<string>();
  for (const raw of rawFacts) {
    if (!raw || typeof raw !== 'object') badRequest('Each fact needs a figure and a name.');
    const item = raw as Record<string, unknown>;
    const value = oneLine(item.value);
    const label = oneLine(item.label);
    if (!value && !label) continue;
    if (!value || !label) badRequest('Each fact needs a figure and a name.');
    if (value.length > FACT_VALUE_MAX) badRequest('A fact figure is 16 characters or less.');
    if (label.length > FACT_LABEL_MAX) badRequest('A fact name is 32 characters or less.');
    const key = label.toLowerCase();
    if (factNames.has(key)) badRequest('Each fact can appear only once.');
    factNames.add(key);
    facts.push({ value, label });
  }

  const rawValues = Array.isArray(source.values) ? source.values : [];
  if (rawValues.length > VALUE_MAX) badRequest('The About page holds 6 values.');
  const values: AboutValueInput[] = [];
  const valueNames = new Set<string>();
  for (const raw of rawValues) {
    if (!raw || typeof raw !== 'object') badRequest('Each value needs a title and a description.');
    const item = raw as Record<string, unknown>;
    const title = oneLine(item.title);
    const bodyText = oneLine(item.body);
    const icon = oneLine(item.icon);
    if (!title && !bodyText && !icon) continue;
    if (!title || !bodyText) badRequest('Each value needs a title and a description.');
    if (title.length > VALUE_TITLE_MAX) badRequest('A value title is 40 characters or less.');
    if (bodyText.length > VALUE_BODY_MAX) badRequest('A value description is 240 characters or less.');
    if (!(ABOUT_ICONS as readonly string[]).includes(icon)) {
      badRequest('Choose a ribbon, bulb, heart, shield, people, or leaf.');
    }
    const key = title.toLowerCase();
    if (valueNames.has(key)) badRequest('Each value can appear only once.');
    valueNames.add(key);
    values.push({ icon: icon as AboutIcon, title, body: bodyText });
  }

  return { missionTitle, missionBody, facts, values };
}
