import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateOrderStatusBody, validateProductUpdateBody } from './validate.js';

const refusal = (fn: () => unknown, pattern: RegExp) =>
  assert.throws(fn, (err: any) => err.statusCode === 400 && pattern.test(err.message));

describe('validateOrderStatusBody', () => {
  it('accepts each known status', () => {
    for (const status of ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']) {
      assert.equal(validateOrderStatusBody({ status }).status, status);
    }
  });

  it('refuses unknown or missing statuses', () => {
    refusal(() => validateOrderStatusBody({ status: 'lost in transit' }), /must be one of/);
    refusal(() => validateOrderStatusBody({ status: 'Delivered' }), /must be one of/);
    refusal(() => validateOrderStatusBody({}), /required/);
  });

  it('keeps a short note and drops an empty one', () => {
    assert.equal(validateOrderStatusBody({ status: 'shipped', note: '  Courier 123  ' }).note, 'Courier 123');
    assert.equal(validateOrderStatusBody({ status: 'shipped', note: '' }).note, undefined);
    refusal(() => validateOrderStatusBody({ status: 'shipped', note: 'x'.repeat(501) }), /at most 500/);
  });
});

describe('validateProductUpdateBody', () => {
  it('leaves untouched fields out', () => {
    const body = validateProductUpdateBody({ name: 'Cable' });
    assert.equal('price' in body, false);
    assert.equal('brandName' in body, false);
  });

  it('reads a new price, null as "remove the price", and refuses zero or text', () => {
    assert.equal(validateProductUpdateBody({ price: '380' }).price, 380);
    assert.equal(validateProductUpdateBody({ price: null }).price, null);
    refusal(() => validateProductUpdateBody({ price: 0 }), /more than ₹0/);
    refusal(() => validateProductUpdateBody({ price: '' }), /price/);
    refusal(() => validateProductUpdateBody({ price: 'abc' }), /price/);
  });

  it('reads an empty or null brand as "clear the brand"', () => {
    assert.equal(validateProductUpdateBody({ brandName: '  Havells ' }).brandName, 'Havells');
    assert.equal(validateProductUpdateBody({ brandName: '' }).brandName, null);
    assert.equal(validateProductUpdateBody({ brandName: '   ' }).brandName, null);
    assert.equal(validateProductUpdateBody({ brandName: null }).brandName, null);
    refusal(() => validateProductUpdateBody({ brandName: 'x'.repeat(256) }), /at most 255/);
  });

  it('keeps a pack size that is left out, and refuses one that is not a whole number', () => {
    assert.equal(validateProductUpdateBody({ name: 'Cable' }).quantityStep, undefined);
    assert.equal(validateProductUpdateBody({ quantityStep: '6' }).quantityStep, 6);
    assert.equal(validateProductUpdateBody({ quantityStep: 1 }).quantityStep, 1);
    refusal(() => validateProductUpdateBody({ quantityStep: 0 }), /quantityStep/);
    refusal(() => validateProductUpdateBody({ quantityStep: 1.5 }), /whole number/);
  });

  it('reads a stock reason and refuses one that is not received, counted, or damaged', () => {
    assert.equal(validateProductUpdateBody({ stockReason: 'counted' }).stockReason, 'counted');
    assert.equal(validateProductUpdateBody({ name: 'Cable' }).stockReason, undefined);
    assert.equal(validateProductUpdateBody({ stockReason: '' }).stockReason, null);
    refusal(() => validateProductUpdateBody({ stockReason: 'stolen' }), /received, counted, or damaged/);
  });
});
