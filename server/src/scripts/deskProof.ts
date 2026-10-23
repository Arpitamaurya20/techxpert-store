/**
 * Anonymous read of what the phone receives after a desk change.
 *
 *   PROOF_API=https://staging-api.example.com \
 *   PROOF_BANNER="Diwali Cement Week" \
 *   PROOF_HIDDEN_BANNER="Monsoon sale" \
 *   PROOF_SECTIONS=hero_carousel,category_shortcuts,trust_strip \
 *   PROOF_PRODUCT=1204 PROOF_TIER=10:8 \
 *   npm run proof:desk
 *
 * PROOF_SECTIONS is the leading part of the home order you set; later blocks are not checked.
 */
import { deskProofGaps } from '../utils/deskAccess.js';

function required(name: string): string {
  const value = (process.env[name] || '').trim();
  if (!value) {
    console.error(`Set ${name}`);
    process.exit(2);
  }
  return value;
}

async function readList(url: string): Promise<any[]> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  const body: any = await res.json();
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (body?.data && typeof body.data === 'object') return [body.data];
  throw new Error(`${url} did not return a list`);
}

async function main() {
  const api = required('PROOF_API').replace(/\/+$/, '');
  const bannerTitle = required('PROOF_BANNER');
  const hiddenBannerTitle = (process.env.PROOF_HIDDEN_BANNER || '').trim() || undefined;
  const sectionOrder = required('PROOF_SECTIONS')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const productId = required('PROOF_PRODUCT');
  const [minRaw, valueRaw] = required('PROOF_TIER').split(':');
  const tier = { minQty: Number(minRaw), discountValue: Number(valueRaw) };
  if (!Number.isFinite(tier.minQty) || !Number.isFinite(tier.discountValue)) {
    console.error('PROOF_TIER must look like 10:8 (minimum quantity : discount value)');
    process.exit(2);
  }

  const [banners, sections, products] = await Promise.all([
    readList(`${api}/cms/banners`),
    readList(`${api}/cms/sections`),
    readList(`${api}/catalog/products/${encodeURIComponent(productId)}`),
  ]);

  const publicOrder = sections.filter((section) => section.enabled !== false);
  const gaps = deskProofGaps({
    banners,
    sections: publicOrder.slice(0, sectionOrder.length),
    tiers: Array.isArray(products[0]?.bulkTiers) ? products[0].bulkTiers : [],
    bannerTitle,
    hiddenBannerTitle,
    sectionOrder,
    tier,
  });

  console.log(`Banners on the phone: ${banners.map((b) => b.title).join(' | ') || '(none)'}`);
  console.log(`Home order: ${publicOrder.map((s) => s.type).join(' → ')}`);
  console.log(
    `Tiers on product ${productId}: ${
      (products[0]?.bulkTiers || []).map((t: any) => `${t.minQty}+ at ${t.discountValue}`).join(', ') || '(none)'
    }`,
  );

  if (gaps.length > 0) {
    console.error('\nNot yet what the desk set:');
    for (const gap of gaps) console.error(`- ${gap}`);
    process.exit(1);
  }
  console.log('\nThe public API matches the desk.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
