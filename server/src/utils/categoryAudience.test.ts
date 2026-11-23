import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/**
 * Mirrors the customer vs staff category audience rules in CatalogService.getCategories
 * (Ack 23 Nov): customers only see shelves with a sellable count; staff see empty shells too.
 */
function forAudience(
  rows: { id: number; name: string; productCount: number }[],
  audience: 'customer' | 'staff'
) {
  if (audience === 'staff') return rows;
  return rows.filter((row) => row.productCount > 0);
}

describe('category audience filter', () => {
  const shelves = [
    { id: 10, name: 'Industrial', productCount: 7776 },
    { id: 1, name: 'Electrical Appliances', productCount: 0 },
    { id: 8, name: 'Electrical', productCount: 26377 },
  ];

  it('hides empty shelves from customers', () => {
    const visible = forAudience(shelves, 'customer');
    assert.deepEqual(
      visible.map((r) => r.id),
      [10, 8]
    );
  });

  it('keeps empty shelves for staff', () => {
    const visible = forAudience(shelves, 'staff');
    assert.equal(visible.length, 3);
    assert.ok(visible.some((r) => r.productCount === 0));
  });
});
