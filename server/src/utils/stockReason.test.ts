import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  changedStock,
  readStockReason,
  stockChangeDetails,
  stockChangeRefusal,
} from './stockReason.js';

describe('stock reason', () => {
  it('accepts received, counted and damaged, and an empty reason', () => {
    assert.equal(readStockReason('received'), 'received');
    assert.equal(readStockReason('counted'), 'counted');
    assert.equal(readStockReason('damaged'), 'damaged');
    assert.equal(readStockReason(''), null);
    assert.equal(readStockReason(undefined), null);
    assert.throws(() => readStockReason('stolen'), /received, counted, or damaged/);
  });

  it('asks for a reason only when a quantity changes', () => {
    const same = changedStock([{ label: 'White', before: 68, after: 68 }]);
    assert.equal(same.length, 0);
    assert.equal(stockChangeRefusal(same, null), null);

    const changed = changedStock([
      { label: 'White', before: 68, after: 67 },
      { label: 'Brown', before: 60, after: 60 },
    ]);
    assert.equal(changed.length, 1);
    assert.equal(stockChangeRefusal(changed, null), 'Say why the stock changed: received, counted, or damaged.');
    assert.equal(stockChangeRefusal(changed, 'counted'), null);
  });

  it('names a new store quantity, a cleared one, and a company change', () => {
    const changes = changedStock([
      { label: 'White', before: 68, after: 70 },
      { label: 'White at Bhutani Tower Store', before: null, after: 10 },
      { label: 'Brown at Bhutani Tower Store', before: 4, after: null },
    ]);
    const details = stockChangeDetails('Ceiling fan', 'received', changes);
    assert.match(details, /Ceiling fan: Received/);
    assert.match(details, /White 68 to 70/);
    assert.match(details, /White at Bhutani Tower Store set to 10/);
    assert.match(details, /Brown at Bhutani Tower Store cleared/);
    assert.equal(details.includes('9876543210'), false);
  });
});
