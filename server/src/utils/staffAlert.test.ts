import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { orderAlert, readAlertSeen, requestAlert } from './staffAlert.js';

describe('orderAlert', () => {
  it('says a pending order is waiting and a confirmed order is confirmed', () => {
    const pending = orderAlert({ orderNumber: 'TX-ORD-1', status: 'pending', grandTotal: 333.82 });
    assert.equal(pending.headline, 'TX-ORD-1');
    assert.match(pending.detail, /Waiting for confirmation/);
    assert.match(pending.detail, /₹333\.82/);
    assert.match(pending.detail, /goods are held/);
    const confirmed = orderAlert({ orderNumber: 'TX-ORD-2', status: 'confirmed', grandTotal: 100 });
    assert.match(confirmed.detail, /^Confirmed\. ₹100\.00\.$/);
  });
});

describe('requestAlert', () => {
  it('says nothing is ordered and does not carry a phone number', () => {
    const alert = requestAlert({ id: 4, lineCount: 1, grandTotal: 23482 });
    assert.equal(alert.headline, 'Talk to us 4');
    assert.match(alert.detail, /1 line/);
    assert.match(alert.detail, /Nothing is ordered/);
    assert.doesNotMatch(`${alert.headline} ${alert.detail}`, /\d{10}/);
  });
});

describe('readAlertSeen', () => {
  it('accepts seen true and refuses anything else', () => {
    assert.doesNotThrow(() => readAlertSeen({ seen: true }));
    assert.throws(() => readAlertSeen({ seen: false }), /seen it/);
    assert.throws(() => readAlertSeen({}), /seen it/);
  });
});
