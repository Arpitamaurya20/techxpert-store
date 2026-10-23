import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { restocksOnCancel, statusChangeRefusal } from './orderRules.js';

describe('statusChangeRefusal', () => {
  it('allows moving an open order along or cancelling it', () => {
    for (const from of ['pending', 'confirmed', 'processing', 'shipped']) {
      assert.equal(statusChangeRefusal(from, 'cancelled'), null);
      assert.equal(statusChangeRefusal(from, 'delivered'), null);
    }
  });

  it('refuses cancelling a delivered order', () => {
    assert.match(statusChangeRefusal('delivered', 'cancelled') ?? '', /delivered order can't be cancelled/);
  });

  it('still lets a delivered order be corrected to another open status', () => {
    assert.equal(statusChangeRefusal('delivered', 'shipped'), null);
  });

  it('treats cancelled as final, including cancelling again', () => {
    for (const to of ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']) {
      assert.match(statusChangeRefusal('cancelled', to) ?? '', /already cancelled/);
    }
  });
});

describe('restocksOnCancel', () => {
  it('is true only for orders placed through this shop', () => {
    assert.equal(restocksOnCancel('TX-ORD-229934-371'), true);
    assert.equal(restocksOnCancel('ORD-20260118-0001'), false);
    assert.equal(restocksOnCancel(''), false);
    assert.equal(restocksOnCancel(null), false);
  });
});
