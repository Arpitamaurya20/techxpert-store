import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readTalkRequest, readTalkStatus, talkNote, talkRefusal } from './talkRequest.js';

const limits = { min: 1, max: 50, stock: 10, step: 1 };

describe('talkRefusal', () => {
  it('allows a quantity the shelf cannot cover', () => {
    assert.equal(talkRefusal('Cement', 100, limits, 400), null);
    assert.equal(talkRefusal('Cement', 4, { ...limits, stock: 0 }, 400), null);
  });

  it('still refuses a missing price and a broken pack', () => {
    assert.match(talkRefusal('Cement', 10, limits, null)!, /not available/);
    assert.match(talkRefusal('Bags', 4, { min: 1, max: null, stock: 40, step: 6 }, 100)!, /multiples of 6/);
  });
});

describe('talkNote', () => {
  it('names the shelf shortfall and stays quiet when the line fits', () => {
    assert.match(talkNote('Cement', 100, limits)!, /only 10 are in stock/);
    assert.match(talkNote('Cement', 100, limits)!, /shelf limit is 50/);
    assert.equal(talkNote('Cement', 6, limits), null);
    assert.match(talkNote('Cement', 4, { ...limits, stock: 0 })!, /out of stock/);
  });
});

describe('readTalkRequest', () => {
  it('keeps a phone, a pincode and a merged line', () => {
    const request = readTalkRequest({
      name: '  Ravi   Kumar ',
      phone: '+91 99999 99999',
      pincode: '201301',
      note: 'Call after 6',
      lines: [
        { productId: 3, quantity: 2 },
        { productId: 3, variantId: 4, quantity: 6 },
        { productId: 3, quantity: 3 },
      ],
    });
    assert.equal(request.name, 'Ravi Kumar');
    assert.equal(request.phone, '9999999999');
    assert.equal(request.lines.length, 2);
    assert.equal(request.lines[0].quantity, 5);
    assert.equal(request.lines[1].variantId, 4);
  });

  it('refuses an empty cart and a short phone', () => {
    assert.throws(() => readTalkRequest({ name: 'Ravi', phone: '9999999999', pincode: '201301', lines: [] }), /at least one product/);
    assert.throws(() => readTalkRequest({ name: 'Ravi', phone: '123', pincode: '201301', lines: [{ productId: 3, quantity: 1 }] }), /10-digit/);
  });
});

describe('readTalkStatus', () => {
  it('accepts new and closed only', () => {
    assert.equal(readTalkStatus({ status: 'closed' }), 'closed');
    assert.throws(() => readTalkStatus({ status: 'done' }), /new or closed/);
  });
});
