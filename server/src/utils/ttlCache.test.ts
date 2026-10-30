import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createTtlCache } from './ttlCache.js';

describe('createTtlCache', () => {
  it('returns undefined until set', () => {
    const cache = createTtlCache<number>(60_000);
    assert.equal(cache.get(), undefined);
  });

  it('returns the value inside the TTL', () => {
    const cache = createTtlCache<string>(60_000);
    cache.set('ok');
    assert.equal(cache.get(), 'ok');
  });

  it('clears on clear()', () => {
    const cache = createTtlCache<string>(60_000);
    cache.set('ok');
    cache.clear();
    assert.equal(cache.get(), undefined);
  });

  it('expires after the TTL', async () => {
    const cache = createTtlCache<string>(20);
    cache.set('ok');
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(cache.get(), undefined);
  });
});
