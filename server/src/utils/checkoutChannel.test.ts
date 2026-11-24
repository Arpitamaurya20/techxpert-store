import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCheckoutChannel } from './checkoutChannel.js';

describe('resolveCheckoutChannel', () => {
  it('forces homecare_app from the exchange token and ignores the body', () => {
    assert.equal(
      resolveCheckoutChannel({ tokenChannel: 'homecare_app', bodyChannel: 'store_app' }),
      'homecare_app'
    );
  });

  it('defaults Store Expo (no bridge channel) to store_app', () => {
    assert.equal(resolveCheckoutChannel({ tokenChannel: undefined, bodyChannel: undefined }), 'store_app');
    assert.equal(resolveCheckoutChannel({ tokenChannel: undefined, bodyChannel: 'store_app' }), 'store_app');
  });

  it('allows an explicit body channel when there is no token channel', () => {
    assert.equal(
      resolveCheckoutChannel({ tokenChannel: undefined, bodyChannel: 'homecare_app' }),
      'homecare_app'
    );
  });
});
