import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { areaCodeFor, deliveryPincode, normalizePincode } from './pincode.js';

describe('normalizePincode', () => {
  it('accepts six digits that do not start with 0', () => {
    assert.equal(normalizePincode('201309'), '201309');
    assert.equal(normalizePincode(' 201 309 '), '201309');
    assert.equal(normalizePincode(201016), '201016');
  });

  it('rejects anything else', () => {
    for (const raw of ['01309', '012345', '20130', '2013090', 'abcdef', '', null, undefined]) {
      assert.equal(normalizePincode(raw), null, String(raw));
    }
  });
});

describe('deliveryPincode', () => {
  it('prefers the pincode field the phone sends', () => {
    assert.equal(deliveryPincode('201016', 'Flat 2, Noida - 201309'), '201016');
  });

  it('falls back to the last six-digit number in the address', () => {
    assert.equal(deliveryPincode(undefined, 'Plot 110001, Sector 62, Noida - 201309 (Other)'), '201309');
    assert.equal(deliveryPincode('', 'Rasoolpur nawada, Noida, Uttar Pradesh 201309 (Default)'), '201309');
  });

  it('finds nothing when the address has no pincode', () => {
    assert.equal(deliveryPincode(undefined, 'Sector 62, Noida'), null);
    assert.equal(deliveryPincode('12', undefined), null);
  });
});

describe('areaCodeFor', () => {
  it('fits the ten-character area code column', () => {
    assert.equal(areaCodeFor('201016'), 'P201016');
    assert.ok(areaCodeFor('999999').length <= 10);
  });
});
