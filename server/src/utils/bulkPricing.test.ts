import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { bulkPrice, type Tier } from './bulkPricing.js';

const percent = (id: number, minQty: number, discountValue: number, maxQty: number | null = null): Tier => ({
  id,
  minQty,
  maxQty,
  discountType: 'percentage',
  discountValue,
  terms: '',
});
const fixed = (id: number, minQty: number, unitPrice: number, maxQty: number | null = null): Tier => ({
  id,
  minQty,
  maxQty,
  discountType: 'fixed_price',
  discountValue: unitPrice,
  terms: '',
});

describe('bulkPrice', () => {
  it('charges the base price when no tier covers the quantity', () => {
    const result = bulkPrice([percent(1, 10, 5)], 3, 400);
    assert.equal(result.unitPrice, 400);
    assert.equal(result.subtotal, 1200);
    assert.equal(result.appliedTier, null);
  });

  it('takes a percentage off the base price', () => {
    const result = bulkPrice([percent(1, 10, 10)], 10, 400);
    assert.equal(result.unitPrice, 360);
    assert.equal(result.discountPerUnit, 40);
    assert.equal(result.totalSavings, 400);
    assert.equal(result.discountPercent, 10);
    assert.equal(result.appliedTier?.id, 1);
  });

  it("reports a percentage tier's own percent, not one worked back from rounded rupees", () => {
    assert.equal(bulkPrice([percent(1, 1, 10)], 1, 0.15).discountPercent, 10);
  });

  it('uses a fixed tier as the unit price', () => {
    const result = bulkPrice([fixed(2, 10, 350)], 10, 400);
    assert.equal(result.unitPrice, 350);
    assert.equal(result.discountPerUnit, 50);
    assert.equal(result.discountPercent, 12.5);
  });

  it('picks the lowest unit price when a percent and a fixed tier overlap', () => {
    // 20% of ₹400 is ₹320; a fixed ₹350 has the larger raw value but is the worse price.
    const tiers = [fixed(2, 10, 350), percent(1, 10, 20)];
    assert.equal(bulkPrice(tiers, 10, 400).appliedTier?.id, 1);
    // On a ₹1,000 product the fixed ₹350 wins over 20% (₹800).
    assert.equal(bulkPrice(tiers, 10, 1000).appliedTier?.id, 2);
  });

  it('ignores a tier that would not lower the price', () => {
    const result = bulkPrice([fixed(2, 10, 450), percent(3, 10, 0)], 10, 400);
    assert.equal(result.unitPrice, 400);
    assert.equal(result.appliedTier, null);
  });

  it('respects the tier quantity range', () => {
    const tiers = [percent(1, 10, 10, 49), percent(2, 50, 20)];
    assert.equal(bulkPrice(tiers, 49, 100).appliedTier?.id, 1);
    assert.equal(bulkPrice(tiers, 50, 100).appliedTier?.id, 2);
  });

  it('never goes below zero', () => {
    const result = bulkPrice([percent(1, 1, 150)], 2, 100);
    assert.equal(result.unitPrice, 0);
    assert.equal(result.subtotal, 0);
  });

  it('treats a missing or bad quantity as 1', () => {
    assert.equal(bulkPrice([], 0, 250).subtotal, 250);
    assert.equal(bulkPrice([], Number.NaN, 250).subtotal, 250);
  });
});
