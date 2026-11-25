import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  LOGIN_CART_SEQUENCE,
  attachStoreJwtOnPath,
  cartTransportHeaders,
  checkoutTransport,
  guestSessionHeader,
  preferCartAfterMerge,
  retireIdempotencyKey,
  reuseOrMintIdempotencyKey,
  shouldPersistGuestSession,
} from './cartAuthPolicy.ts';

const GUEST = 'a'.repeat(32);
const TOKEN = 'store-jwt';

describe('guest cart', () => {
  it('adds a product with the guest session and no JWT', () => {
    assert.deepEqual(cartTransportHeaders({ sessionId: GUEST, accountLinked: false }), {
      'x-session-id': GUEST,
    });
    assert.equal(attachStoreJwtOnPath('/cart/items/5', true, false), false);
    assert.equal(guestSessionHeader({ sessionId: GUEST, token: undefined, accountLinked: false })['x-session-id'], GUEST);
  });

  it('keeps the same guest session for the next cart call', () => {
    assert.equal(shouldPersistGuestSession(false), true);
    const first = cartTransportHeaders({ sessionId: GUEST, accountLinked: false });
    const second = cartTransportHeaders({ sessionId: GUEST, accountLinked: false });
    assert.equal(first['x-session-id'], second['x-session-id']);
  });
});

describe('login merge', () => {
  it('persists the JWT, keeps the original session, merges, then refreshes', () => {
    assert.deepEqual(LOGIN_CART_SEQUENCE, [
      'persist-jwt',
      'keep-guest-session',
      'merge-with-bearer-and-original-session',
      'refresh-account-cart',
    ]);
    assert.equal(shouldPersistGuestSession(true), false);
  });

  it('calls merge with the original session and attaches the JWT only on /cart/merge', () => {
    assert.equal(attachStoreJwtOnPath('/cart/merge', true, false), true);
    assert.equal(attachStoreJwtOnPath('/cart', true, false), false);
    assert.deepEqual(guestSessionHeader({ token: TOKEN, sessionId: GUEST, accountLinked: false }), {
      'x-session-id': GUEST,
    });
  });

  it('shows the merged account cart, not a later empty guest cart', () => {
    assert.equal(
      preferCartAfterMerge({ id: '173', lineCount: 1 }, { id: '175', lineCount: 0 }),
      'merged'
    );
    assert.equal(
      preferCartAfterMerge({ id: '173', lineCount: 1 }, { id: '173', lineCount: 1 }),
      'fetched'
    );
  });

  it('reloads the account cart with the JWT and does not send the guest session', () => {
    assert.deepEqual(cartTransportHeaders({ token: TOKEN, sessionId: GUEST, accountLinked: true }), {
      Authorization: `Bearer ${TOKEN}`,
    });
    assert.deepEqual(guestSessionHeader({ token: TOKEN, sessionId: GUEST, accountLinked: true }), {});
    assert.equal(attachStoreJwtOnPath('/cart', true, true), true);
    assert.equal(attachStoreJwtOnPath('/cart', false, true), false);
  });
});

describe('checkout', () => {
  it('uses the account cart id and JWT, and does not send the guest session', () => {
    assert.deepEqual(
      checkoutTransport({ paymentMethod: 'COD', signedIn: true, accountLinked: true, cartId: '173' }),
      { cartId: '173', sendSession: false, sendJwt: true }
    );
    assert.deepEqual(
      checkoutTransport({ paymentMethod: 'PayU', signedIn: true, accountLinked: true, cartId: '173' }),
      { cartId: '173', sendSession: false, sendJwt: true }
    );
  });

  it('refuses PayU without a JWT and refuses checkout when merge has not finished', () => {
    assert.deepEqual(checkoutTransport({ paymentMethod: 'PayU', signedIn: false, accountLinked: false, cartId: '165' }), {
      error: 'Sign in to pay online.',
    });
    const pending = checkoutTransport({
      paymentMethod: 'COD',
      signedIn: true,
      accountLinked: false,
      cartId: '165',
    });
    assert.equal('error' in pending, true);
  });

  it('reuses one Idempotency-Key for the same checkout and mints a new one when the body changes', () => {
    const same = reuseOrMintIdempotencyKey({ key: 'store-checkout-173-1', fingerprint: 'payu' }, 'payu', () => 'new');
    assert.equal(same.key, 'store-checkout-173-1');
    const changed = reuseOrMintIdempotencyKey(
      { key: 'store-checkout-173-1', fingerprint: 'payu' },
      'payu-with-phone',
      () => 'store-checkout-173-2'
    );
    assert.equal(changed.key, 'store-checkout-173-2');
  });

  it('retires a key the server rejected or a failure that left the cart unchanged', () => {
    assert.equal(
      retireIdempotencyKey(409, 'Checkout with this Idempotency-Key is already in progress or used with a different body.'),
      true
    );
    assert.equal(retireIdempotencyKey(503, "We couldn't place your order. Your cart is unchanged."), true);
    assert.equal(retireIdempotencyKey(undefined, 'Network request failed'), false);
  });
});
