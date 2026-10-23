/**
 * Blocks the phone home can draw, in SRS §6 order.
 * Keep aliases in sync with app/src/services/cmsApi.ts.
 * informational_strip is in the SRS list and has no phone block, so it stays off this desk.
 */
export const HOMEPAGE_SECTIONS = [
  {
    type: 'category_shortcuts',
    aliases: ['category_shortcuts'],
    title: 'Category shortcuts',
    description: 'Horizontal shortcuts for Cement, Tiles, Paints, Plywood, Plumbing, Electrical, and Tools.',
    position: 1,
  },
  {
    type: 'hero_carousel',
    aliases: ['hero_carousel', 'hero_banners', 'banner_carousel'],
    title: 'Campaign hero',
    description: 'Published banners, one at a time.',
    position: 2,
  },
  {
    type: 'trust_strip',
    aliases: ['trust_strip'],
    title: 'Trust strip',
    description: 'Verified claims: delivery, genuine products, bulk pricing, support.',
    position: 3,
  },
  {
    type: 'category_grid',
    aliases: ['category_grid', 'popular_categories'],
    title: 'Shop by project',
    description: 'Project cards that open the categories for that job.',
    position: 4,
  },
  {
    type: 'order_again_rail',
    aliases: ['order_again_rail', 'order_again'],
    title: 'Order again',
    description: 'Reorder rail for a signed-in customer.',
    position: 5,
  },
  {
    type: 'offer_tiles',
    aliases: ['offer_tiles'],
    title: 'Deals for your projects',
    description: 'Offer tiles for project categories.',
    position: 6,
  },
  {
    type: 'product_rail',
    aliases: ['product_rail', 'featured_products', 'best_sellers', 'product_grid'],
    title: 'Popular products',
    description: 'Featured product rail.',
    position: 7,
  },
  {
    type: 'bulk_enquiry',
    aliases: ['bulk_enquiry'],
    title: 'Quick tools',
    description: 'Calculator, wishlist, and other home tools.',
    position: 8,
  },
] as const;

export type HomepageSectionType = (typeof HOMEPAGE_SECTIONS)[number]['type'];

const ALIAS_TO_TYPE = new Map<string, HomepageSectionType>();
for (const def of HOMEPAGE_SECTIONS) {
  for (const alias of def.aliases) {
    ALIAS_TO_TYPE.set(alias, def.type);
  }
}

export function canonicalSectionType(code?: string | null, type?: string | null): HomepageSectionType | null {
  const codeKey = normalizeKey(code);
  const typeKey = normalizeKey(type);
  if (codeKey && ALIAS_TO_TYPE.has(codeKey)) return ALIAS_TO_TYPE.get(codeKey) ?? null;
  if (typeKey && ALIAS_TO_TYPE.has(typeKey)) return ALIAS_TO_TYPE.get(typeKey) ?? null;
  return null;
}

export type StoredSectionRow = {
  id?: string | number;
  sectionCode?: string | null;
  sectionType?: string | null;
  type?: string | null;
  title?: string | null;
  description?: string | null;
  position?: number | null;
  displayOrder?: number | null;
  enabled?: boolean | number | string | null;
  isEnabled?: boolean | number | string | null;
};

export type LayoutSection = {
  id: string;
  type: HomepageSectionType;
  sectionCode: HomepageSectionType;
  title: string;
  description: string;
  enabled: boolean;
  position: number;
};

/** One row per phone block. Unknown stored rows are dropped. Missing blocks use the SRS default. */
export function layoutSections(rows: StoredSectionRow[], audience: 'admin' | 'customer' = 'admin'): LayoutSection[] {
  const byType = new Map<HomepageSectionType, StoredSectionRow>();
  const stored = [...rows].sort(
    (a, b) => sectionPosition(a, Number.MAX_SAFE_INTEGER) - sectionPosition(b, Number.MAX_SAFE_INTEGER),
  );
  for (const row of stored) {
    const type = canonicalSectionType(row.sectionCode, row.sectionType ?? row.type);
    if (!type || byType.has(type)) continue;
    byType.set(type, row);
  }

  const laidOut = HOMEPAGE_SECTIONS.map((def) => {
    const row = byType.get(def.type);
    if (!row) {
      return {
        id: def.type,
        type: def.type,
        sectionCode: def.type,
        title: def.title,
        description: def.description,
        enabled: true,
        position: def.position,
      };
    }
    return {
      id: String(row.id ?? def.type),
      type: def.type,
      sectionCode: def.type,
      title: textOr(row.title, def.title),
      description: textOr(row.description, def.description),
      enabled: asEnabled(row.isEnabled ?? row.enabled, true),
      position: sectionPosition(row, def.position),
    };
  });

  laidOut.sort((a, b) => a.position - b.position || defIndex(a.type) - defIndex(b.type));
  if (audience === 'customer') return laidOut.filter((section) => section.enabled);
  return laidOut;
}

export function aliasesFor(type: HomepageSectionType): readonly string[] {
  return HOMEPAGE_SECTIONS.find((def) => def.type === type)?.aliases ?? [type];
}

function defIndex(type: HomepageSectionType): number {
  return HOMEPAGE_SECTIONS.findIndex((def) => def.type === type);
}

function sectionPosition(row: StoredSectionRow, fallback: number): number {
  const value = Number(row.position ?? row.displayOrder);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function textOr(value: string | null | undefined, fallback: string): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function asEnabled(value: boolean | number | string | null | undefined, fallback: boolean): boolean {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const raw = String(value).toLowerCase();
  if (raw === '1' || raw === 'true') return true;
  if (raw === '0' || raw === 'false') return false;
  return fallback;
}

function normalizeKey(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}
