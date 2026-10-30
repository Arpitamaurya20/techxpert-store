/**
 * Proof that the card list and the full list agree. Run against the real database:
 *   npm run proof:cards
 * For each case it reads the same products both ways and fails if any shared field differs
 * (price, stock, status, image, brand, quantities) or if the `after` cursor skips or repeats a product.
 */
import { CatalogService } from '../services/catalogService.js';
import { storePool } from '../db/mysql.js';

const SHARED = [
  'id', 'sku', 'name', 'categoryId', 'categoryName', 'subcategoryId', 'brandName', 'imageUrl',
  'stockStatus', 'minOrderQuantity', 'maxOrderQuantity', 'quantityStep', 'featured',
  'price', 'originalPrice', 'unit', 'stockQuantity',
] as const;
const LEFT_OUT = ['description', 'createdAt', 'variantCount'] as const;

let failures = 0;
const fail = (msg: string) => {
  failures += 1;
  console.error(`  FAIL ${msg}`);
};

async function compare(label: string, filters: Record<string, unknown>, pricedOnly: boolean) {
  const full = await CatalogService.getProducts({ ...filters, pricedOnly, limit: 40 });
  const card = await CatalogService.getProducts({
    ...filters, pricedOnly, limit: 40, view: 'card', includeTotal: false,
  });
  const tag = `${label} (${pricedOnly ? 'customer' : 'staff'})`;
  console.log(`${tag}: ${full.products.length} rows`);
  const searching = Boolean(filters.search);

  // Card search may return more rows (synonyms / FULLTEXT) and ranks differently from the full list.
  if (!searching && full.products.length !== card.products.length) {
    fail(`${tag}: ${full.products.length} full rows vs ${card.products.length} card rows`);
    return;
  }

  const fullById = new Map(full.products.map((r: any) => [String(r.id), r]));
  for (const lean of card.products as any[]) {
    const row = fullById.get(String(lean.id));
    if (!row) {
      // Synonym / FULLTEXT-only hits are allowed on the card path.
      if (!searching) fail(`${tag}: card has product ${lean.id} missing from full list`);
      continue;
    }
    for (const key of SHARED) {
      if (JSON.stringify(row[key]) !== JSON.stringify(lean[key])) {
        fail(`${tag}: product ${row.id} ${key}: ${JSON.stringify(row[key])} vs ${JSON.stringify(lean[key])}`);
      }
    }
    for (const key of LEFT_OUT) {
      if (key in lean) fail(`${tag}: product ${row.id} card row still has ${key}`);
    }
  }
  if ('total' in (card.meta as any)) fail(`${tag}: card meta has total although total=false`);

  // Cursor proof needs shared ID order; skip when card search ranks hits.
  if (searching) return;

  const first = await CatalogService.getProducts({ ...filters, pricedOnly, limit: 10, view: 'card', includeTotal: false });
  const next = (first.meta as any).nextAfter;
  if (next != null) {
    const second = await CatalogService.getProducts({
      ...filters, pricedOnly, limit: 10, view: 'card', includeTotal: false, after: next,
    });
    const want = full.products.slice(10, 20).map((r: any) => r.id);
    const got = second.products.map((r: any) => r.id);
    if (JSON.stringify(want) !== JSON.stringify(got)) fail(`${tag}: cursor gave ${got} not ${want}`);
  }
}

async function main() {
  const categories = await CatalogService.getCategories();
  const brands = await CatalogService.getBrands();
  const cases: Array<[string, Record<string, unknown>]> = [
    ['everything', {}],
    ['featured', { featured: true }],
    ['search fan', { search: 'fan' }],
  ];
  if (categories[0]) cases.push(['first category', { categoryId: categories[0].id }]);
  if (brands[0]) cases.push(['top brand', { brandId: brands[0].id }]);

  for (const [label, filters] of cases) {
    await compare(label, filters, true);
    await compare(label, filters, false);
  }
  await storePool.end();
  if (failures) {
    console.error(`\n${failures} difference(s). Do not ship.`);
    process.exit(1);
  }
  console.log('\nCard and full lists agree.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
