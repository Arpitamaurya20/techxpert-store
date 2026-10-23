export type PublicBanner = { title?: string; status?: string };
export type PublicSection = { type?: string; enabled?: boolean };
export type PublicTier = { minQty?: number; discountValue?: number; discountType?: string };

/**
 * What an anonymous phone call must reflect after a desk save.
 * Returns the checks that failed.
 */
export function deskProofGaps(input: {
  banners: PublicBanner[];
  sections: PublicSection[];
  tiers: PublicTier[];
  bannerTitle: string;
  hiddenBannerTitle?: string;
  sectionOrder: string[];
  tier: { minQty: number; discountValue: number };
}): string[] {
  const gaps: string[] = [];
  const titles = input.banners.map((banner) => String(banner.title || ''));
  if (!titles.includes(input.bannerTitle)) {
    gaps.push(`public banners do not include "${input.bannerTitle}"`);
  }
  if (input.hiddenBannerTitle && titles.includes(input.hiddenBannerTitle)) {
    gaps.push(`public banners still include "${input.hiddenBannerTitle}"`);
  }
  const order = input.sections.filter((section) => section.enabled !== false).map((section) => String(section.type || ''));
  if (order.join(',') !== input.sectionOrder.join(',')) {
    gaps.push(`public section order is ${order.join(' → ') || '(empty)'}`);
  }
  const tier = input.tiers.find(
    (row) => Number(row.minQty) === input.tier.minQty && Number(row.discountValue) === input.tier.discountValue,
  );
  if (!tier) {
    gaps.push(`public tiers do not include ${input.tier.minQty}+ at ${input.tier.discountValue}`);
  }
  return gaps;
}
