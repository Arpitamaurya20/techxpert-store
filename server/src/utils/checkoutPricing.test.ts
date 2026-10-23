import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { guestOrderOwner, isOrderRefusal, orderFailed } from './checkoutPricing.js';

describe('guestOrderOwner', () => {
  it('creates a customer only for an unregistered 10-digit phone', () => {
    assert.equal(guestOrderOwner('9876543210', null), 'new_customer');
  });

  it('keeps the order a guest order when the phone already has an account', () => {
    assert.equal(guestOrderOwner('9876543210', 42), 'guest');
  });

  it('keeps the order a guest order without a usable phone', () => {
    for (const phone of ['', '98765', '98765432101', 'abcdefghij']) {
      assert.equal(guestOrderOwner(phone, null), 'guest');
    }
  });
});

describe('orderFailed', () => {
  it('is a 503 that is not mistaken for a refusal', () => {
    const err = orderFailed() as Error & { statusCode: number };
    assert.equal(err.statusCode, 503);
    assert.equal(isOrderRefusal(err), false);
    assert.match(err.message, /cart is unchanged/);
  });
});

describe('isOrderRefusal', () => {
  it('treats 4xx errors as refusals to send back as they are', () => {
    assert.equal(isOrderRefusal(Object.assign(new Error('x'), { statusCode: 409 })), true);
    assert.equal(isOrderRefusal(Object.assign(new Error('x'), { statusCode: 404 })), true);
  });

  it('leaves database and unknown failures to the outage path', () => {
    assert.equal(isOrderRefusal(Object.assign(new Error('x'), { statusCode: 503 })), false);
    assert.equal(isOrderRefusal(Object.assign(new Error('x'), { code: 'ECONNREFUSED' })), false);
    assert.equal(isOrderRefusal(null), false);
  });
});
