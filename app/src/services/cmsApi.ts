import type { Href } from 'expo-router';
import type { ImageSourcePropType } from 'react-native';

import { HERO_SLIDES, type HeroSlide } from '@/data/homeContent';
import { API_BASE_URL, isApiConfigured } from './apiConfig';
import { ApiError, apiGet } from './apiClient';
import { asId, asRecord, asText, normalizeList, type RawRecord } from './normalize';

/** Absolute URL for CMS image paths so Expo Image can load them (L5). */
function resolveMediaUrl(url: string): string {
  const raw = url.trim();
  if (!raw) return raw;
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) return raw;
  if (!raw.startsWith('/')) return raw;
  // Uploaded campaign files are on the API, even when other assets use a website origin.
  if (raw.startsWith('/uploads/')) {
    if (!API_BASE_URL) return raw;
    return `${API_BASE_URL}${raw}`;
  }
  const assetBase = (process.env.EXPO_PUBLIC_ASSET_BASE_URL ?? '').trim().replace(/\/+$/, '');
  const base = assetBase || API_BASE_URL;
  if (!base) return raw;
  return `${base}${raw}`;
}

export type CmsBanner = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  ctaLabel: string;
  ctaType: string;
  ctaTarget: string;
  status?: string;
};

export type CmsSection = {
  id: string;
  sectionCode: string;
  type: string;
  title: string;
  enabled: boolean;
  position: number;
  description?: string;
};

/** Phone blocks. Keep aliases in sync with server/src/data/homepageSections.ts. */
const HOMEPAGE_SECTION_ALIASES: Record<string, string> = {
  category_shortcuts: 'category_shortcuts',
  hero_carousel: 'hero_carousel',
  hero_banners: 'hero_carousel',
  banner_carousel: 'hero_carousel',
  trust_strip: 'trust_strip',
  category_grid: 'category_grid',
  popular_categories: 'category_grid',
  order_again_rail: 'order_again_rail',
  order_again: 'order_again_rail',
  offer_tiles: 'offer_tiles',
  product_rail: 'product_rail',
  featured_products: 'product_rail',
  best_sellers: 'product_rail',
  product_grid: 'product_rail',
  bulk_enquiry: 'bulk_enquiry',
};

export function canonicalHomepageType(code?: string | null, type?: string | null): string | null {
  const codeKey = String(code ?? '').trim().toLowerCase();
  const typeKey = String(type ?? '').trim().toLowerCase();
  if (codeKey && HOMEPAGE_SECTION_ALIASES[codeKey]) return HOMEPAGE_SECTION_ALIASES[codeKey];
  if (typeKey && HOMEPAGE_SECTION_ALIASES[typeKey]) return HOMEPAGE_SECTION_ALIASES[typeKey];
  return null;
}

function mapCtaHref(ctaType?: string, ctaTarget?: string): Href {
  const target = (ctaTarget || '').trim();
  const type = (ctaType || '').toLowerCase();

  if (target.startsWith('/')) return target as Href;

  if (type === 'category' || type === 'categories') {
    const id = target || '1';
    return { pathname: '/category/[id]', params: { id } };
  }
  if (type === 'product' || type === 'products') {
    if (target) return { pathname: '/products/[id]', params: { id: target } };
    return '/products';
  }
  if (type === 'url' && target) {
    // In-app paths only; external URLs fall back to shop
    if (target.startsWith('/')) return target as Href;
  }
  return '/products';
}

function normalizeBanner(raw: unknown): CmsBanner | null {
  const row = asRecord(raw);
  if (!row) return null;
  const id = asId(row.id);
  const title = asText(row.title);
  const imageUrl = asText(row.imageUrl) || asText(row.image_url);
  if (!id || !title || !imageUrl) return null;
  return {
    id,
    title,
    subtitle: asText(row.subtitle) || '',
    imageUrl,
    ctaLabel: asText(row.ctaLabel) || asText(row.cta_label) || 'Shop Now',
    ctaType: asText(row.ctaType) || asText(row.cta_type) || 'category',
    ctaTarget: asText(row.ctaTarget) || asText(row.cta_target) || '/products',
    status: asText(row.status),
  };
}

function normalizeSection(raw: unknown): CmsSection | null {
  const row = asRecord(raw);
  if (!row) return null;
  const id = asId(row.id);
  const rawCode = asText(row.sectionCode) || asText(row.section_code) || asText(row.type);
  const type = canonicalHomepageType(rawCode, asText(row.type) || asText(row.sectionType) || asText(row.section_type));
  if (!id || !type) return null;
  const enabledRaw = row.enabled ?? row.isEnabled ?? row.is_enabled;
  const enabled =
    enabledRaw === true ||
    enabledRaw === 1 ||
    enabledRaw === '1' ||
    String(enabledRaw).toLowerCase() === 'true';
  return {
    id,
    sectionCode: type,
    type,
    title: asText(row.title) || type,
    enabled,
    position: Number(row.position ?? row.displayOrder ?? row.display_order ?? 0) || 0,
    description: asText(row.description),
  };
}

export function bannerToHeroSlide(banner: CmsBanner): HeroSlide {
  const image: ImageSourcePropType = { uri: resolveMediaUrl(banner.imageUrl) };
  return {
    id: banner.id,
    image,
    tone: 'dark',
    eyebrow: banner.subtitle ? banner.subtitle.split('\n')[0] : 'Offer',
    title: banner.title,
    subtitle: banner.subtitle,
    cta: banner.ctaLabel,
    href: mapCtaHref(banner.ctaType, banner.ctaTarget),
  };
}

/** Published banners from CMS; falls back to static HERO_SLIDES when API is off or empty. */
export async function getHeroSlides(): Promise<{ slides: HeroSlide[]; source: 'live' | 'demo' }> {
  if (!isApiConfigured) {
    return { slides: HERO_SLIDES, source: 'demo' };
  }
  try {
    const boot = await getHomeBoot().catch(() => null);
    if (boot?.source === 'live' && boot.data.banners.length > 0) {
      return { slides: boot.data.banners.map(bannerToHeroSlide), source: 'live' };
    }
    const raw = await apiGet('/cms/banners');
    const banners = normalizeList(raw, normalizeBanner);
    if (banners.length === 0) {
      return { slides: HERO_SLIDES, source: 'demo' };
    }
    return { slides: banners.map(bannerToHeroSlide), source: 'live' };
  } catch (err) {
    if (err instanceof ApiError && err.code === 'NOT_CONFIGURED') {
      return { slides: HERO_SLIDES, source: 'demo' };
    }
    throw err;
  }
}

/** Homepage section order/visibility from CMS; empty list means use app default layout. */
export async function getHomepageSections(): Promise<{
  sections: CmsSection[];
  source: 'live' | 'demo';
}> {
  if (!isApiConfigured) {
    return { sections: [], source: 'demo' };
  }
  try {
    const boot = await getHomeBoot().catch(() => null);
    if (boot?.source === 'live' && boot.data.sections.length > 0) {
      return { sections: boot.data.sections, source: 'live' };
    }
    const raw = await apiGet('/cms/sections');
    const sections = normalizeList(raw, normalizeSection)
      .filter((s) => s.enabled)
      .sort((a, b) => a.position - b.position);
    return { sections, source: 'live' };
  } catch (err) {
    if (err instanceof ApiError && err.code === 'NOT_CONFIGURED') {
      return { sections: [], source: 'demo' };
    }
    throw err;
  }
}

export type CmsBundle<T> = { data: T; source: 'live' | 'demo' };

export type HomeShortcut = {
  categoryId: string;
  label: string;
  name: string;
  imageUrl: string;
};

export type HomeProjectCategory = { categoryId: string; name: string };

export type HomeProject = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  calculator: '' | 'paint' | 'tiles' | 'cement';
  categories: HomeProjectCategory[];
};

export type HomeContent = { shortcuts: HomeShortcut[]; projects: HomeProject[] };

export type TrustClaim = {
  label: string;
  icon: 'truck-fast-outline' | 'shield-check-outline' | 'tag-outline' | 'headset';
  action: 'delivery' | 'about' | 'help' | 'phone';
};

export type AboutFact = { value: string; label: string };
export type AboutValue = {
  icon: 'ribbon-outline' | 'bulb-outline' | 'heart-outline' | 'shield-checkmark-outline' | 'people-outline' | 'leaf-outline';
  title: string;
  body: string;
};
export type AboutContent = {
  missionTitle: string;
  missionBody: string;
  facts: AboutFact[];
  values: AboutValue[];
};

export type PolicyBlock = string | string[];
export type PolicyPage = {
  id: 'privacy' | 'terms' | 'cancellation' | 'shipping';
  title: string;
  lastUpdated: string;
  sourceUrl: string;
  intro: string[];
  sections: { heading: string; blocks: PolicyBlock[] }[];
};

export type DealTile = {
  categoryId: string;
  name: string;
  title: string;
  highlight: string;
  tagline: string;
  tone: 'peach' | 'navy';
  imageUrl: string;
};

export type HelpFaq = { id: string; question: string; answer: string };
export type HelpContent = {
  phone: string;
  phoneLabel: string;
  whatsapp: string;
  email: string;
  hours: string;
  faqs: HelpFaq[];
};

const TRUST_ICONS = new Set<TrustClaim['icon']>([
  'truck-fast-outline',
  'shield-check-outline',
  'tag-outline',
  'headset',
]);
const TRUST_ACTIONS = new Set<TrustClaim['action']>(['delivery', 'about', 'help', 'phone']);
const ABOUT_ICONS = new Set<AboutValue['icon']>([
  'ribbon-outline',
  'bulb-outline',
  'heart-outline',
  'shield-checkmark-outline',
  'people-outline',
  'leaf-outline',
]);
const CALCULATORS = new Set<HomeProject['calculator']>(['paint', 'tiles', 'cement']);
const POLICY_IDS = new Set<PolicyPage['id']>(['privacy', 'terms', 'cancellation', 'shipping']);

function objectPayload(raw: unknown): RawRecord {
  const record = asRecord(raw);
  if (!record) throw new ApiError('INVALID_RESPONSE', 'We received an unexpected response from the server.');
  if (record.success === true && record.data !== undefined) {
    const data = asRecord(record.data);
    if (!data) throw new ApiError('INVALID_RESPONSE', 'We received an unexpected response from the server.');
    return data;
  }
  return record;
}

async function readCms<T>(path: string, map: (payload: RawRecord) => T, empty: T): Promise<CmsBundle<T>> {
  if (!isApiConfigured) return { data: empty, source: 'demo' };
  try {
    return { data: map(objectPayload(await apiGet(path))), source: 'live' };
  } catch (err) {
    if (err instanceof ApiError && err.code === 'NOT_CONFIGURED') return { data: empty, source: 'demo' };
    throw err;
  }
}

function textList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const text = asText(item);
    return text ? [text] : [];
  });
}

const EMPTY_HOME: HomeContent = { shortcuts: [], projects: [] };
const EMPTY_ABOUT: AboutContent = { missionTitle: '', missionBody: '', facts: [], values: [] };
const EMPTY_HELP: HelpContent = { phone: '', phoneLabel: '', whatsapp: '', email: '', hours: '', faqs: [] };

export type HomeBoot = {
  sections: CmsSection[];
  home: HomeContent;
  searchSuggestions: string[];
  trust: TrustClaim[];
  banners: CmsBanner[];
  deals: DealTile[];
  featuredRaw: unknown[];
  categoriesRaw: unknown[];
};

let homeBootRequest: Promise<CmsBundle<HomeBoot>> | null = null;

function mapHomeContent(payload: unknown): HomeContent {
  const record = asRecord(payload) ?? {};
  return {
    shortcuts: Array.isArray(record.shortcuts)
      ? record.shortcuts.flatMap((row) => {
          const item = asRecord(row);
          const categoryId = asId(item?.categoryId);
          if (!item || !categoryId || item.available === false) return [];
          const name = asText(item.name) ?? '';
          const label = asText(item.label) ?? name;
          if (!label) return [];
          return [{ categoryId, label, name: name || label, imageUrl: resolveMediaUrl(asText(item.imageUrl) ?? '') }];
        })
      : [],
    projects: Array.isArray(record.projects)
      ? record.projects.flatMap((row) => {
          const item = asRecord(row);
          const id = asId(item?.id);
          const title = asText(item?.title);
          if (!item || !id || !title) return [];
          const calculatorText = asText(item.calculator) ?? '';
          const calculator = CALCULATORS.has(calculatorText as HomeProject['calculator'])
            ? (calculatorText as HomeProject['calculator'])
            : '';
          const categories = Array.isArray(item.categories)
            ? item.categories.flatMap((category) => {
                const cat = asRecord(category);
                const categoryId = asId(cat?.categoryId);
                if (!cat || !categoryId || cat.available === false) return [];
                return [{ categoryId, name: asText(cat.name) ?? '' }];
              })
            : [];
          return [
            {
              id,
              title,
              subtitle: asText(item.subtitle) ?? '',
              imageUrl: resolveMediaUrl(asText(item.imageUrl) ?? ''),
              calculator,
              categories,
            },
          ];
        })
      : [],
  };
}

function mapTrustClaims(payload: unknown): TrustClaim[] {
  const record = asRecord(payload) ?? {};
  const claims = Array.isArray(record.claims) ? record.claims : [];
  return claims.flatMap((row) => {
    const item = asRecord(row);
    const label = asText(item?.label);
    const icon = asText(item?.icon);
    const action = asText(item?.action);
    if (!item || !label || !icon || !action) return [];
    if (!TRUST_ICONS.has(icon as TrustClaim['icon']) || !TRUST_ACTIONS.has(action as TrustClaim['action'])) {
      return [];
    }
    return [{ label, icon: icon as TrustClaim['icon'], action: action as TrustClaim['action'] }];
  });
}

function mapDeals(payload: unknown): DealTile[] {
  const record = asRecord(payload) ?? {};
  const deals = Array.isArray(record.deals) ? record.deals : Array.isArray(payload) ? payload : [];
  return deals.flatMap((row) => {
    const item = asRecord(row);
    const categoryId = asId(item?.categoryId);
    const title = asText(item?.title);
    if (!item || !categoryId || !title || item.available === false) return [];
    const tone = asText(item.tone) === 'navy' ? 'navy' : 'peach';
    return [
      {
        categoryId,
        name: asText(item.name) ?? title,
        title,
        highlight: asText(item.highlight) ?? '',
        tagline: asText(item.tagline) ?? '',
        tone,
        imageUrl: resolveMediaUrl(asText(item.imageUrl) ?? ''),
      },
    ];
  });
}

/**
 * Preferred home payload (docs UC-1 / handover): sections, banners, deals,
 * featured cards, categories, shortcuts, trust and search chips in one call.
 */
export function getHomeBoot(options: { force?: boolean } = {}): Promise<CmsBundle<HomeBoot>> {
  if (!isApiConfigured) {
    return Promise.resolve({
      data: {
        sections: [],
        home: EMPTY_HOME,
        searchSuggestions: [],
        trust: [],
        banners: [],
        deals: [],
        featuredRaw: [],
        categoriesRaw: [],
      },
      source: 'demo',
    });
  }
  if (options.force || !homeBootRequest) {
    const request = apiGet('/cms/home-boot')
      .then((raw): CmsBundle<HomeBoot> => {
        const payload = objectPayload(raw);
        return {
          source: 'live',
          data: {
            sections: normalizeList(payload.sections ?? [], normalizeSection)
              .filter((s) => s.enabled)
              .sort((a, b) => a.position - b.position),
            home: mapHomeContent(payload.home ?? payload),
            searchSuggestions: textList(
              asRecord(payload.searchSuggestions)?.suggestions ?? payload.searchSuggestions
            ),
            trust: mapTrustClaims(payload.trust ?? payload),
            banners: normalizeList(payload.banners ?? [], normalizeBanner),
            deals: mapDeals(payload.deals ?? payload),
            featuredRaw: Array.isArray(payload.featured) ? payload.featured : [],
            categoriesRaw: Array.isArray(payload.categories) ? payload.categories : [],
          },
        };
      })
      .catch((err) => {
        if (homeBootRequest === request) homeBootRequest = null;
        throw err;
      });
    homeBootRequest = request;
  }
  return homeBootRequest;
}

export async function getHomeContent(): Promise<CmsBundle<HomeContent>> {
  const boot = await getHomeBoot().catch(() => null);
  if (boot?.source === 'live') return { data: boot.data.home, source: 'live' };
  return readCms('/cms/home', (payload) => mapHomeContent(payload), EMPTY_HOME);
}

export async function getSearchIdeas(): Promise<CmsBundle<string[]>> {
  const boot = await getHomeBoot().catch(() => null);
  if (boot?.source === 'live') return { data: boot.data.searchSuggestions, source: 'live' };
  return readCms('/cms/search-suggestions', (payload) => textList(payload.suggestions), []);
}

export async function getTrustClaims(): Promise<CmsBundle<TrustClaim[]>> {
  const boot = await getHomeBoot().catch(() => null);
  if (boot?.source === 'live') return { data: boot.data.trust, source: 'live' };
  return readCms('/cms/trust', (payload) => mapTrustClaims(payload), []);
}

export function getAboutPage(): Promise<CmsBundle<AboutContent>> {
  return readCms(
    '/cms/about',
    (payload) => ({
      missionTitle: asText(payload.missionTitle) ?? '',
      missionBody: asText(payload.missionBody) ?? '',
      facts: Array.isArray(payload.facts)
        ? payload.facts.flatMap((row) => {
            const record = asRecord(row);
            const value = asText(record?.value);
            const label = asText(record?.label);
            if (!value || !label) return [];
            return [{ value, label }];
          })
        : [],
      values: Array.isArray(payload.values)
        ? payload.values.flatMap((row) => {
            const record = asRecord(row);
            const icon = asText(record?.icon);
            const title = asText(record?.title);
            const body = asText(record?.body);
            if (!icon || !title || !body || !ABOUT_ICONS.has(icon as AboutValue['icon'])) return [];
            return [{ icon: icon as AboutValue['icon'], title, body }];
          })
        : [],
    }),
    EMPTY_ABOUT
  );
}

export function getPolicies(): Promise<CmsBundle<PolicyPage[]>> {
  return readCms(
    '/cms/policies',
    (payload) =>
      Array.isArray(payload.policies)
        ? payload.policies.flatMap((row) => {
            const record = asRecord(row);
            const id = asText(record?.id);
            const title = asText(record?.title);
            if (!record || !id || !title || !POLICY_IDS.has(id as PolicyPage['id'])) return [];
            const sections = Array.isArray(record.sections)
              ? record.sections.flatMap((section) => {
                  const item = asRecord(section);
                  const heading = asText(item?.heading);
                  if (!item || !heading) return [];
                  const blocks: PolicyBlock[] = Array.isArray(item.blocks)
                    ? item.blocks.flatMap((block): PolicyBlock[] => {
                        if (typeof block === 'string' && block.trim()) return [block.trim()];
                        if (!Array.isArray(block)) return [];
                        const points = block.flatMap((point) => {
                          const text = asText(point);
                          return text ? [text] : [];
                        });
                        return points.length > 0 ? [points] : [];
                      })
                    : [];
                  return [{ heading, blocks }];
                })
              : [];
            return [
              {
                id: id as PolicyPage['id'],
                title,
                lastUpdated: asText(record.lastUpdated) ?? '',
                sourceUrl: asText(record.sourceUrl) ?? '',
                intro: textList(record.intro),
                sections,
              },
            ];
          })
        : [],
    []
  );
}

export async function getDeals(): Promise<CmsBundle<DealTile[]>> {
  const boot = await getHomeBoot().catch(() => null);
  if (boot?.source === 'live') return { data: boot.data.deals, source: 'live' };
  return readCms('/cms/deals', (payload) => mapDeals(payload), []);
}

export function getHelpContent(): Promise<CmsBundle<HelpContent>> {
  return readCms(
    '/cms/help',
    (payload) => ({
      phone: asText(payload.phone) ?? '',
      phoneLabel: asText(payload.phoneLabel) ?? '',
      whatsapp: asText(payload.whatsapp) ?? '',
      email: asText(payload.email) ?? '',
      hours: asText(payload.hours) ?? '',
      faqs: Array.isArray(payload.faqs)
        ? payload.faqs.flatMap((row) => {
            const record = asRecord(row);
            const id = asId(record?.id);
            const question = asText(record?.question);
            const answer = asText(record?.answer);
            if (!id || !question || !answer) return [];
            return [{ id, question, answer }];
          })
        : [],
    }),
    EMPTY_HELP
  );
}
