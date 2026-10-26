import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readOrderChannel } from './orderChannel.js';

describe('readOrderChannel', () => {
  it('uses the store app when the client does not say', () => {
    assert.equal(readOrderChannel(undefined, 'store_app'), 'store_app');
    assert.equal(readOrderChannel('', 'store_app'), 'store_app');
  });

  it('keeps an explicit home-service app', () => {
    assert.equal(readOrderChannel('homecare_app', 'store_app'), 'homecare_app');
  });

  it('refuses an unknown app', () => {
    assert.throws(() => readOrderChannel('web', 'store_app'), /home-service app/);
  });
});
