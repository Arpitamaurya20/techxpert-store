import { assertHttpOrPathUrl, badRequest } from './validate.js';

/** Seven shortcuts plus the app's own More tile fill two rows. */
export const SHORTCUT_MAX = 7;
export const PROJECT_MAX = 12;
export const PROJECT_CATEGORY_MAX = 8;
export const CALCULATORS = ['paint', 'tiles', 'cement'] as const;
export type Calculator = (typeof CALCULATORS)[number] | '';

export type ShortcutInput = { categoryId: number; label: string };
export type ProjectInput = {
  title: string;
  subtitle: string;
  imageUrl: string;
  calculator: Calculator;
  categoryIds: number[];
};
export type HomeInput = { shortcuts: ShortcutInput[]; projects: ProjectInput[] };

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function categoryId(value: unknown, where: string): number {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) {
    badRequest(`${where} must be a category number.`);
  }
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
 * The shortcut row and project tiles staff can save before any of it is chosen.
 * An empty body clears the page. Saving replaces the whole page.
 */
export function validateHomeBody(body: unknown): HomeInput {
  const source = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  if (source.shortcuts !== undefined && !Array.isArray(source.shortcuts)) badRequest('shortcuts must be a list.');
  if (source.projects !== undefined && !Array.isArray(source.projects)) badRequest('projects must be a list.');
  const rawShortcuts = Array.isArray(source.shortcuts) ? source.shortcuts : [];
  const rawProjects = Array.isArray(source.projects) ? source.projects : [];
  if (rawShortcuts.length > SHORTCUT_MAX) {
    badRequest('The home row holds 7 categories. The app adds More after them.');
  }
  if (rawProjects.length > PROJECT_MAX) badRequest('You can show up to 12 projects.');

  const seen = new Set<number>();
  const shortcuts = rawShortcuts.map((row, index) => {
    if (!row || typeof row !== 'object') badRequest('Each shortcut needs a category.');
    const item = row as Record<string, unknown>;
    const id = categoryId(item.categoryId, `Shortcut ${index + 1}`);
    if (seen.has(id)) badRequest('Each shortcut needs a different category.');
    seen.add(id);
    const label = text(item.label);
    if (label.length > 24) badRequest('A shortcut name must be 24 characters or less.');
    return { categoryId: id, label };
  });

  const projects = rawProjects.map((row, index) => {
    if (!row || typeof row !== 'object') badRequest('Each project needs a title.');
    const item = row as Record<string, unknown>;
    const title = text(item.title);
    if (!title) badRequest('Each project needs a title.');
    if (title.length > 60) badRequest('A project title must be 60 characters or less.');
    const subtitle = text(item.subtitle);
    if (subtitle.length > 80) badRequest('A project subtitle must be 80 characters or less.');
    const calculator = text(item.calculator);
    if (calculator && !(CALCULATORS as readonly string[]).includes(calculator)) {
      badRequest('The estimator must be paint, tiles, cement, or left blank.');
    }
    if (!Array.isArray(item.categoryIds) || item.categoryIds.length === 0) {
      badRequest('Each project needs at least one category.');
    }
    if (item.categoryIds.length > PROJECT_CATEGORY_MAX) badRequest('A project can list up to 8 categories.');
    const categoryIds: number[] = [];
    const local = new Set<number>();
    item.categoryIds.forEach((raw, categoryIndex) => {
      const id = categoryId(raw, `Project ${index + 1}, category ${categoryIndex + 1}`);
      if (local.has(id)) badRequest('Each project lists a category only once.');
      local.add(id);
      categoryIds.push(id);
    });
    return {
      title,
      subtitle,
      imageUrl: imageAddress(text(item.imageUrl)),
      calculator: calculator as Calculator,
      categoryIds,
    };
  });

  return { shortcuts, projects };
}
