import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hashCheckoutBody, idempotencyDecision } from './checkoutIdempotency.js';

describe('hashCheckoutBody', () => {
  it('is stable for the same payload', () => {
    const a = hashCheckoutBody({ expectedTotal: 10, addressId: 1 });
    const b = hashCheckoutBody({ expectedTotal: 10, addressId: 1 });
    assert.equal(a, b);
  });

  it('changes when the body changes', () => {
    const a = hashCheckoutBody({ expectedTotal: 10 });
    const b = hashCheckoutBody({ expectedTotal: 11 });
    assert.notEqual(a, b);
  });
});

describe('idempotencyDecision', () => {
  it('replays a completed row with the same hash', () => {
    const d = idempotencyDecision({
      existing: { requestHash: 'abc', status: 'completed', statusCode: 200, responseJson: '{"ok":true}' },
      requestHash: 'abc',
    });
    assert.equal(d.action, 'replay');
    assert.equal(d.statusCode, 200);
  });

  it('conflicts when the hash differs', () => {
    const d = idempotencyDecision({
      existing: { requestHash: 'abc', status: 'completed', statusCode: 200, responseJson: '{}' },
      requestHash: 'other',
    });
    assert.equal(d.action, 'conflict');
  });

  it('conflicts while the first request is in flight', () => {
    const d = idempotencyDecision({
      existing: { requestHash: 'abc', status: 'pending', statusCode: null, responseJson: null },
      requestHash: 'abc',
    });
    assert.equal(d.action, 'conflict');
  });

  it('proceeds when there is no row', () => {
    assert.equal(idempotencyDecision({ existing: null, requestHash: 'abc' }).action, 'proceed');
  });
});
