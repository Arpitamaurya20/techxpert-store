import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chosenVariantId, variantStockUpdates } from './variants.js';

describe('chosenVariantId', () => {
  it('leaves the choice out when the caller did not send one', () => {
    assert.equal(chosenVariantId(undefined), null);
    assert.equal(chosenVariantId(null), null);
    assert.equal(chosenVariantId(''), null);
  });

  it('reads a variant number and refuses anything else', () => {
    assert.equal(chosenVariantId(4), 4);
    assert.equal(chosenVariantId('7'), 7);
    assert.throws(() => chosenVariantId(0), /variant number/);
    assert.throws(() => chosenVariantId('brown'), /variant number/);
  });
});

describe('variantStockUpdates', () => {
  it('is absent until the caller edits options', () => {
    assert.equal(variantStockUpdates(undefined), undefined);
  });

  it('keeps each option once, with a whole stock', () => {
    assert.deepEqual(variantStockUpdates([{ id: '4', stockQuantity: 60 }, { id: 5, stockQuantity: 0 }]), [
      { id: 4, stockQuantity: 60 },
      { id: 5, stockQuantity: 0 },
    ]);
  });

  it('refuses a repeated option or a stock that is not a whole number', () => {
    assert.throws(() => variantStockUpdates([{ id: 4, stockQuantity: 1 }, { id: 4, stockQuantity: 2 }]), /once/);
    assert.throws(() => variantStockUpdates([{ id: 4, stockQuantity: 1.5 }]), /whole number/);
    assert.throws(() => variantStockUpdates('4'), /list/);
  });
});
