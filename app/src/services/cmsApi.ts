import type { Href } from 'expo-router';
import type { ImageSourcePropType } from 'react-native';

import { HERO_SLIDES, type HeroSlide } from '@/data/homeContent';
import { API_BASE_URL, isApiConfigured } from './apiConfig';
import { ApiError, apiGet } from './apiClient';
import { asId, asRecord, asText, normalizeList } from './normalize';

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
