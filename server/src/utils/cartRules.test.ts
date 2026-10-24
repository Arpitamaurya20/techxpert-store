import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  cartTotals,
  isUsableSessionId,
  lineLimits,
  lineProblem,
  mergeQuantity,
  newSessionId,
  priceLine,
  quantityRefusal,
  reorderTarget,
  sameMoney,
} from './cartRules.js';

describe('lineLimits', () => {
  it('reads the minimum, maximum and stock, treating blanks as no limit', () => {
    assert.deepEqual(lineLimits({ minOrderQuantity: 5, maxOrderQuantity: 200, stock: 40 }), { min: 5, max: 200, stock: 40, step: 1 });
    assert.deepEqual(lineLimits({ minOrderQuantity: null, maxOrderQuantity: 0, quantityStep: 6, stock: null }), {
      min: 1,
      max: null,
      stock: 0,
      step: 6,
    });
    assert.deepEqual(lineLimits({ minOrderQuantity: null, maxOrderQuantity: 0, stock: null }), { min: 1, max: null, stock: 0, step: 1 });
  });
});

describe('quantityRefusal', () => {
  const limits = { min: 5, max: 50, stock: 30 };

  it('accepts a quantity inside the limits', () => {
    assert.equal(quantityRefusal('Cement', 10, limits, 400), null);
  });

  it('explains each refusal in a sentence the customer can act on', () => {
    assert.match(quantityRefusal('Cement', 10, limits, null)!, /not available to order/);
    assert.match(quantityRefusal('Cement', 10, { ...limits, stock: 0 }, 400)!, /out of stock/);
    assert.match(quantityRefusal('Cement', 3, limits, 400)!, /at least 5/);
    assert.match(quantityRefusal('Cement', 31, limits, 400)!, /Only 30/);
    assert.match(quantityRefusal('Cement', 60, { ...limits, stock: 100 }, 400)!, /up to 50/);
    assert.match(quantityRefusal('Cement', 2.5, limits, 400)!, /whole number/);
  });

  it('refuses a quantity that is not a whole pack', () => {
    const packs = { min: 1, max: 50, stock: 40, step: 6 };
    assert.equal(quantityRefusal('Bulbs', 6, packs, 100), null);
    assert.equal(quantityRefusal('Bulbs', 12, packs, 100), null);
    assert.match(quantityRefusal('Bulbs', 1, packs, 100)!, /multiples of 6/);
    assert.match(quantityRefusal('Bulbs', 7, packs, 100)!, /multiples of 6/);
    assert.match(quantityRefusal('Bags', 6, { min: 10, max: null, stock: 40, step: 6 }, 100)!, /starting at 10/);
    assert.equal(quantityRefusal('Bags', 16, { min: 10, max: null, stock: 40, step: 6 }, 100), null);
  });
});

describe('reorderTarget', () => {
  const limits = { min: 1, max: 50, stock: 30 };

  it('adds the ordered quantity on top of the cart', () => {
    assert.deepEqual(reorderTarget('Fan', 2, 1, limits, 100), { setTo: 3, note: null });
  });

  it('stops at the stock and says why the rest was left out', () => {
    const result = reorderTarget('Fan', 40, 0, limits, 100);
    assert.equal('setTo' in result && result.setTo, 30);
    assert.match('note' in result ? (result.note ?? '') : '', /Only 30/);
  });

  it('raises a short order up to the minimum', () => {
    const result = reorderTarget('Cement', 2, 0, { min: 5, max: null, stock: 20 }, 100);
    assert.equal('setTo' in result && result.setTo, 5);
    assert.match('note' in result ? (result.note ?? '') : '', /at least 5/);
  });

  it('raises a short order up to the next pack', () => {
    const result = reorderTarget('Bulbs', 1, 0, { min: 1, max: null, stock: 40, step: 6 }, 100);
    assert.equal('setTo' in result && result.setTo, 6);
    assert.match('note' in result ? (result.note ?? '') : '', /multiples of 6/);
  });

  it('leaves the cart alone when the order does not fill another pack', () => {
    const result = reorderTarget('Bulbs', 1, 6, { min: 1, max: null, stock: 40, step: 6 }, 100);
    assert.match('reason' in result ? result.reason : '', /multiples of 6/);
  });

  it('leaves the cart alone when it is already at the most', () => {
    const result = reorderTarget('Fan', 1, 30, limits, 100);
    assert.match('reason' in result ? result.reason : '', /most of "Fan"/);
  });

  it('skips a product that cannot be bought, and a line with no quantity', () => {
    assert.match(reorderTarget('Fan', 1, 0, { ...limits, stock: 0 }, 100).reason ?? '', /out of stock/);
    assert.match(reorderTarget('Fan', 1, 0, limits, null).reason ?? '', /not available/);
    assert.match(reorderTarget('Fan', 0, 0, limits, 100).reason ?? '', /no quantity/);
  });
});

describe('lineProblem', () => {
  const limits = { min: 1, max: 10, stock: 8 };

  it('flags lines that can no longer be bought as they are', () => {
    assert.equal(lineProblem(4, limits, 100), null);
    assert.equal(lineProblem(4, limits, null), 'price_unavailable');
    assert.equal(lineProblem(4, { ...limits, stock: 0 }, 100), 'out_of_stock');
    assert.equal(lineProblem(9, limits, 100), 'over_limit');
    assert.equal(lineProblem(11, { ...limits, stock: 50 }, 100), 'over_limit');
    assert.equal(lineProblem(7, { min: 1, max: 20, stock: 20, step: 6 }, 100), 'over_limit');
    assert.equal(lineProblem(6, { min: 1, max: 20, stock: 20, step: 6 }, 100), null);
  });
});

describe('mergeQuantity', () => {
  const limits = { min: 1, max: 20, stock: 15 };

  it('keeps the larger quantity instead of adding the two carts together', () => {
    assert.equal(mergeQuantity(4, 6, limits), 6);
    assert.equal(mergeQuantity(6, undefined, limits), 6);
    assert.equal(mergeQuantity(undefined, 3, limits), 3);
  });

  it('caps at the maximum and stock when that still meets the minimum', () => {
    assert.equal(mergeQuantity(12, 18, limits), 15);
    assert.equal(mergeQuantity(30, 2, { min: 1, max: 20, stock: 100 }), 20);
  });

  it('keeps the larger quantity on the pack step', () => {
    assert.equal(mergeQuantity(6, 7, { min: 1, max: null, stock: 40, step: 6 }), 6);
    assert.equal(mergeQuantity(6, 12, { min: 1, max: null, stock: 40, step: 6 }), 12);
  });

  it('leaves the quantity alone when the cap is below the minimum, so the line shows its problem', () => {
    assert.equal(mergeQuantity(10, 4, { min: 5, max: null, stock: 2 }), 10);
  });
});

describe('cartTotals', () => {
  it('adds lines without a problem, then delivery and 18% tax', () => {
    const totals = cartTotals([
      { lineTotal: 1200, savings: 100, problem: null },
      { lineTotal: 300.5, savings: 0, problem: null },
      { lineTotal: 9999, savings: 50, problem: 'out_of_stock' },
    ]);
    assert.deepEqual(totals, { subtotal: 1500.5, bulkSavings: 100, delivery: 99, tax: 270.09, grandTotal: 1869.59 });
  });

  it('delivers free from ₹2,000 and charges nothing for an empty cart', () => {
    assert.equal(cartTotals([{ lineTotal: 2000, savings: 0, problem: null }]).delivery, 0);
    assert.deepEqual(cartTotals([]), { subtotal: 0, bulkSavings: 0, delivery: 0, tax: 0, grandTotal: 0 });
  });
});

describe('priceLine', () => {
  const limits = { min: 1, max: null, stock: 50 };

  it('charges the bulk-tier unit price and counts the savings', () => {
    const line = priceLine(25, limits, '149.00', { unitPrice: 134.1, totalSavings: 372.5, appliedTier: { minQty: 25 } });
    assert.deepEqual(line, {
      basePrice: 149,
      unitPrice: 134.1,
      appliedTier: { minQty: 25 },
      lineTotal: 3352.5,
      savings: 372.5,
      problem: null,
    });
  });

  it('charges the base price when no tier applies', () => {
    const line = priceLine(3, limits, 1999, null);
    assert.equal(line.unitPrice, 1999);
    assert.equal(line.lineTotal, 5997);
    assert.equal(line.savings, 0);
  });

  it('prices nothing for a product without a price and reports why', () => {
    const line = priceLine(3, limits, null, { unitPrice: 10, totalSavings: 0, appliedTier: null });
    assert.deepEqual(line, { basePrice: null, unitPrice: null, appliedTier: null, lineTotal: 0, savings: 0, problem: 'price_unavailable' });
  });

  it('keeps the price but reports a line above stock', () => {
    const line = priceLine(60, limits, 100, null);
    assert.equal(line.lineTotal, 6000);
    assert.equal(line.problem, 'over_limit');
  });
});

describe('sameMoney', () => {
  it('compares rupee amounts to the paisa', () => {
    assert.equal(sameMoney(1869.59, '1869.59'), true);
    assert.equal(sameMoney(0.1 + 0.2, 0.3), true);
    assert.equal(sameMoney(1869.59, 1869.6), false);
    assert.equal(sameMoney(undefined, 0), false);
    assert.equal(sameMoney('abc', 'abc'), false);
  });
});

describe('session ids', () => {
  it('issues long random ids and ignores short or odd ones', () => {
    const id = newSessionId();
    assert.equal(id.length, 64);
    assert.notEqual(id, newSessionId());
    assert.equal(isUsableSessionId(id), true);
    assert.equal(isUsableSessionId('abc123'), false);
    assert.equal(isUsableSessionId(`${'a'.repeat(40)};drop`), false);
    assert.equal(isUsableSessionId(undefined), false);
  });
});
