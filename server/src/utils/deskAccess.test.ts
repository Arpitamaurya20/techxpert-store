import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deskProofGaps } from './deskAccess.js';

describe('deskProofGaps', () => {
  it('passes when the public lists match the desk', () => {
    const gaps = deskProofGaps({
      banners: [{ title: 'Diwali', status: 'published' }],
      sections: [
        { type: 'hero_carousel', enabled: true },
        { type: 'trust_strip', enabled: true },
      ],
      tiers: [{ minQty: 10, discountValue: 8, discountType: 'percentage' }],
      bannerTitle: 'Diwali',
      hiddenBannerTitle: 'Paused sale',
      sectionOrder: ['hero_carousel', 'trust_strip'],
      tier: { minQty: 10, discountValue: 8 },
    });
    assert.deepEqual(gaps, []);
  });

  it('reports a missing banner, a paused one still live, a reordered home, and a missing tier', () => {
    const gaps = deskProofGaps({
      banners: [{ title: 'Paused sale' }],
      sections: [
        { type: 'trust_strip', enabled: true },
        { type: 'hero_carousel', enabled: true },
      ],
      tiers: [],
      bannerTitle: 'Diwali',
      hiddenBannerTitle: 'Paused sale',
      sectionOrder: ['hero_carousel', 'trust_strip'],
      tier: { minQty: 10, discountValue: 8 },
    });
    assert.equal(gaps.length, 4);
  });
});
