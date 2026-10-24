import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { allocationOver, sellableAtStore } from './storeStock.js';

describe('sellableAtStore', () => {
  it('uses the company figure when the store has no quantity of its own', () => {
    assert.equal(sellableAtStore(68, null), 68);
  });

  it('uses the store quantity when it is lower than the company figure', () => {
    assert.equal(sellableAtStore(68, 10), 10);
  });

  it('never lets a store sell more than the company figure', () => {
    assert.equal(sellableAtStore(68, 90), 68);
    assert.equal(sellableAtStore(0, 5), 0);
  });
});

describe('allocationOver', () => {
  it('accepts store quantities that fit inside the company figure', () => {
    assert.equal(allocationOver(68, [10, 20], 'White'), null);
    assert.equal(allocationOver(68, [], 'White'), null);
  });

  it('refuses store quantities that add up to more than the company figure', () => {
    const reason = allocationOver(68, [40, 40], 'White');
    assert.ok(reason);
    assert.match(reason, /80/);
    assert.match(reason, /White/);
    assert.match(reason, /68/);
  });
});
