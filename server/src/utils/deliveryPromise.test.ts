import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { arrivesSentence, deliveryPromise, readDeliveryDays } from './deliveryPromise.js';

describe('readDeliveryDays', () => {
  it('starts off and remembers a number while it is switched off', () => {
    assert.deepEqual(readDeliveryDays({ enabled: false, days: null }), { enabled: false, days: null });
    assert.deepEqual(readDeliveryDays({ enabled: false, days: 3 }), { enabled: false, days: 3 });
    assert.equal(deliveryPromise(readDeliveryDays({ enabled: false, days: 3 })), null);
  });

  it('accepts 1 to 30 days and refuses the rest', () => {
    assert.equal(deliveryPromise(readDeliveryDays({ enabled: true, days: 3 })), 3);
    assert.equal(deliveryPromise(readDeliveryDays({ enabled: true, days: 1 })), 1);
    assert.throws(() => readDeliveryDays({ enabled: true, days: 0 }), /1 to 30/);
    assert.throws(() => readDeliveryDays({ enabled: true, days: 31 }), /1 to 30/);
    assert.throws(() => readDeliveryDays({ enabled: true, days: 2.5 }), /whole number/);
    assert.throws(() => readDeliveryDays({ enabled: true, days: null }), /switched on/);
  });
});

describe('arrivesSentence', () => {
  it('says day or days', () => {
    assert.equal(arrivesSentence(null), null);
    assert.equal(arrivesSentence(1), 'Arrives in 1 day.');
    assert.equal(arrivesSentence(3), 'Arrives in 3 days.');
  });
});
