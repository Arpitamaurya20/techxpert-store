import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canonicalSectionType, layoutSections } from './homepageSections.js';

describe('canonicalSectionType', () => {
  it('maps stored codes onto the blocks the phone draws', () => {
    assert.equal(canonicalSectionType('hero_banners', 'banner_carousel'), 'hero_carousel');
    assert.equal(canonicalSectionType('popular_categories', 'category_grid'), 'category_grid');
    assert.equal(canonicalSectionType('best_sellers', 'product_grid'), 'product_rail');
    assert.equal(canonicalSectionType('featured_products', 'featured_products'), 'product_rail');
  });

  it('drops a stored row the phone cannot draw', () => {
    assert.equal(canonicalSectionType('bulk_deals', 'product_deal_slider'), null);
  });
});

describe('layoutSections', () => {
  const stored = [
    { id: 1, sectionCode: 'hero_banners', sectionType: 'banner_carousel', title: 'Featured Promotions', displayOrder: 1, isEnabled: 1 },
    { id: 2, sectionCode: 'popular_categories', sectionType: 'category_grid', title: 'Shop by Trade Category', displayOrder: 2, isEnabled: 1 },
    { id: 3, sectionCode: 'bulk_deals', sectionType: 'product_deal_slider', title: 'Bulk Contractor Tiers', displayOrder: 3, isEnabled: 1 },
    { id: 4, sectionCode: 'best_sellers', sectionType: 'product_grid', title: 'Best Selling SKUs', displayOrder: 4, isEnabled: 0 },
  ];

  it('returns the phone order and hides a disabled block from customers', () => {
    const customer = layoutSections(stored, 'customer').map((section) => section.type);
    assert.equal(customer.includes('product_rail'), false);
    assert.equal(customer.includes('bulk_enquiry'), true);
    assert.deepEqual(customer.slice(0, 2), ['category_shortcuts', 'hero_carousel']);
    assert.equal(customer.includes('category_grid'), true);
  });

  it('keeps a disabled block on the desk and keeps the stored id', () => {
    const admin = layoutSections(stored, 'admin');
    const rail = admin.find((section) => section.type === 'product_rail');
    assert.equal(rail?.id, '4');
    assert.equal(rail?.enabled, false);
    assert.equal(rail?.title, 'Best Selling SKUs');
    assert.equal(admin.some((section) => section.title === 'Bulk Contractor Tiers'), false);
  });
});
