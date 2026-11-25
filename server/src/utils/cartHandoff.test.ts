import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  cartOwner,
  chooseAccountCart,
  checkoutMayUseCart,
  customerId,
  groupMergeLines,
  paymentMethodAllowed,
  transferredQuantity,
  variantsToTransfer,
} from './cartHandoff.js';

const LIMITS = { min: 1, max: 20, stock: 50, step: 1 };
const GUEST = 'b'.repeat(32);

describe('customer id', () => {
  it('uses the JWT userId as the logical Homecare customer id', () => {
    assert.equal(customerId(21), 21);
    assert.equal(customerId('21'), 21);
    assert.equal(customerId(0), undefined);
    assert.equal(customerId('user-21'), undefined);
  });
});

describe('guest and account carts', () => {
  it('finds a guest cart only from the session when nobody is signed in', () => {
    assert.deepEqual(cartOwner({ sessionId: GUEST }), { sessionId: GUEST });
    assert.deepEqual(cartOwner({}), {});
  });

  it('ignores the guest session once a JWT userId is present', () => {
    assert.deepEqual(cartOwner({ userId: 21, sessionId: GUEST }), { userId: 21 });
  });

  it('returns the account cart that holds the lines, not a newer empty cart', () => {
    const chosen = chooseAccountCart([
      { id: 175, userId: 21, itemCount: 0 },
      { id: 173, userId: 21, itemCount: 1 },
      { id: 165, userId: 0, itemCount: 1 },
    ]);
    assert.equal(chosen?.id, 173);
  });

  it('keeps the oldest account cart when every account cart is empty', () => {
    const chosen = chooseAccountCart([
      { id: 175, userId: 21, itemCount: 0 },
      { id: 173, userId: 21, itemCount: 0 },
    ]);
    assert.equal(chosen?.id, 173);
  });
});

describe('merge', () => {
  it('moves the guest quantity onto the account cart, keeping the larger one', () => {
    const grouped = groupMergeLines([
      { side: 'guest', variantId: 63864, productId: 10, quantity: 1 },
      { side: 'account', variantId: 63864, productId: 10, quantity: 1 },
      { side: 'guest', variantId: 7, productId: 11, quantity: 2 },
      { side: 'guest', variantId: 7, productId: 11, quantity: 5 },
    ]);
    assert.equal(transferredQuantity(grouped.get(63864)!, LIMITS), 1);
    assert.equal(transferredQuantity(grouped.get(7)!, LIMITS), 5);
    assert.equal(variantsToTransfer(grouped).length, 2);
  });

  it('does not transfer again when the guest cart is already merged', () => {
    const grouped = groupMergeLines([
      { side: 'account', variantId: 63864, productId: 10, quantity: 1 },
    ]);
    assert.deepEqual(variantsToTransfer(grouped), []);
    assert.equal(transferredQuantity({ productId: 10, account: 1 }, LIMITS), null);
  });

  it('skips an option that can no longer be sold', () => {
    assert.equal(transferredQuantity({ productId: 10, guest: 1 }, null), null);
  });
});

describe('checkout ownership', () => {
  it('allows the account cart for that JWT user and rejects a stale guest cart', () => {
    assert.equal(
      checkoutMayUseCart({ userId: 21, sessionId: null }, { userId: 21 }),
      true
    );
    assert.equal(
      checkoutMayUseCart({ userId: null, sessionId: GUEST }, { userId: 21, sessionId: GUEST }),
      false
    );
    assert.equal(
      checkoutMayUseCart({ userId: 22, sessionId: null }, { userId: 21 }),
      false
    );
  });

  it('still allows a guest to check out their own session cart', () => {
    assert.equal(
      checkoutMayUseCart({ userId: null, sessionId: GUEST }, { sessionId: GUEST }),
      true
    );
    assert.equal(
      checkoutMayUseCart({ userId: null, sessionId: GUEST }, { sessionId: 'c'.repeat(32) }),
      false
    );
  });

  it('requires a JWT for PayU and accepts COD for a guest or a customer', () => {
    assert.deepEqual(paymentMethodAllowed('PayU', undefined), {
      ok: false,
      status: 401,
      message: 'Sign in to pay online.',
    });
    assert.deepEqual(paymentMethodAllowed('PayU', 21), { ok: true, method: 'PayU' });
    assert.deepEqual(paymentMethodAllowed('COD', 21), { ok: true, method: 'COD' });
    assert.deepEqual(paymentMethodAllowed(undefined, undefined), { ok: true, method: 'COD' });
    assert.equal(paymentMethodAllowed('CARD', 21).ok, false);
  });
});
