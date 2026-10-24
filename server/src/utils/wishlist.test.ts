import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergeSavedIds, savedAvailability, savedProductIds, WISHLIST_MAX } from './wishlist.js';

describe('savedAvailability', () => {
  it('uses today\'s price and stock', () => {
    const item = savedAvailability(true, 1999, 68);
    assert.equal(item.available, true);
    assert.equal(item.price, 1999);
    assert.equal(item.stockQuantity, 68);
    assert.equal(item.stockStatus, 'in_stock');
  });

  it('keeps the three reasons used everywhere else', () => {
    assert.equal(savedAvailability(false, 10, 5).unavailableReason, 'This product is no longer sold.');
    assert.match(savedAvailability(true, null, 5).unavailableReason ?? '', /isn't available to order/);
    assert.match(savedAvailability(true, 10, 0).unavailableReason ?? '', /out of stock/);
  });
});

describe('savedProductIds', () => {
  it('keeps whole product ids and ignores junk', () => {
    assert.deepEqual(savedProductIds(['5', 3, 0, 'nope', 3.5, -1]), [5, 3]);
    assert.deepEqual(savedProductIds(undefined), []);
  });

  it('stops at the cap', () => {
    const ids = savedProductIds(Array.from({ length: WISHLIST_MAX + 10 }, (_, i) => i + 1));
    assert.equal(ids.length, WISHLIST_MAX);
    assert.equal(ids[0], 1);
  });
});

describe('mergeSavedIds', () => {
  it('puts the device list first, then the guest list, then the account', () => {
    assert.deepEqual(mergeSavedIds([1, 2], [3, 1], [4, 3]), [4, 3, 1, 2]);
  });

  it('drops the oldest once the list is full', () => {
    const account = Array.from({ length: WISHLIST_MAX }, (_, i) => i + 1);
    const merged = mergeSavedIds(account, [], [9999]);
    assert.equal(merged.length, WISHLIST_MAX);
    assert.equal(merged[0], 9999);
    assert.equal(merged.includes(WISHLIST_MAX), false);
  });
});
