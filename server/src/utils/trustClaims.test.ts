import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LABEL_MAX, TRUST_MAX, validateTrustClaims } from './trustClaims.js';

const claim = {
  label: 'Fast Delivery',
  icon: 'truck-fast-outline',
  action: 'delivery',
};

describe('validateTrustClaims', () => {
  it('refuses a body that leaves the list out, and accepts an empty list', () => {
    assert.throws(() => validateTrustClaims({}), /must be a list/);
    assert.throws(() => validateTrustClaims(null), /must be a list/);
    assert.deepEqual(validateTrustClaims({ claims: [] }), []);
  });

  it('trims the label and keeps the icon and where the tap goes', () => {
    const claims = validateTrustClaims({
      claims: [{ label: '  Fast   Delivery ', icon: 'truck-fast-outline', action: 'delivery' }],
    });
    assert.deepEqual(claims, [claim]);
  });

  it('refuses a repeated claim, ignoring capital letters', () => {
    assert.throws(
      () =>
        validateTrustClaims({
          claims: [claim, { ...claim, label: 'fast delivery', icon: 'headset', action: 'phone' }],
        }),
      /only once/
    );
  });

  it('refuses a blank, a long label, an unknown icon or tap, and a fifth claim', () => {
    assert.throws(() => validateTrustClaims({ claims: [{ ...claim, label: '  ' }] }), /needs words/);
    assert.throws(
      () => validateTrustClaims({ claims: [{ ...claim, label: 'a'.repeat(LABEL_MAX + 1) }] }),
      /32 characters/
    );
    assert.throws(() => validateTrustClaims({ claims: [{ ...claim, icon: 'star' }] }), /headset/);
    assert.throws(() => validateTrustClaims({ claims: [{ ...claim, action: 'cart' }] }), /phone call/);
    const claims = Array.from({ length: TRUST_MAX + 1 }, (_, index) => ({
      ...claim,
      label: `Claim ${index + 1}`,
    }));
    assert.throws(() => validateTrustClaims({ claims }), /4 claims/);
  });
});
