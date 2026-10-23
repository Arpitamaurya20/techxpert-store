import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { allocateCatalogueStock } from './stockAllocation.js';

describe('allocateCatalogueStock', () => {
  const rows = [
    { id: 1, quantity: 10 },
    { id: 2, quantity: 10 },
    { id: 3, quantity: 10 },
  ];

  it('keeps the earlier rows and puts the remainder on the last row', () => {
    assert.deepEqual(allocateCatalogueStock(rows, 25), [
      { id: 1, quantity: 10 },
      { id: 2, quantity: 10 },
      { id: 3, quantity: 5 },
    ]);
  });

  it('adds extra quantity on the last row', () => {
    const next = allocateCatalogueStock(rows, 40);
    assert.equal(next.reduce((sum, row) => sum + row.quantity, 0), 40);
    assert.equal(next[2].quantity, 20);
  });

  it('zeros later rows when the total shrinks', () => {
    assert.deepEqual(allocateCatalogueStock(rows, 5), [
      { id: 1, quantity: 5 },
      { id: 2, quantity: 0 },
      { id: 3, quantity: 0 },
    ]);
  });
});
