import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizeProductImageForDb,
  resolveCatalogGallery,
  resolveCatalogImageUrl,
} from './catalogMedia.js';

describe('normalizeProductImageForDb', () => {
  it('keeps the prod store path', () => {
    assert.equal(
      normalizeProductImageForDb('store/assets/catalog/Fans/fan.jpg'),
      'store/assets/catalog/Fans/fan.jpg'
    );
  });

  it('strips a leading slash', () => {
    assert.equal(
      normalizeProductImageForDb('/store/assets/catalog/Fans/fan.jpg'),
      'store/assets/catalog/Fans/fan.jpg'
    );
  });

  it('clears a blank picture', () => {
    assert.equal(normalizeProductImageForDb(''), '');
    assert.equal(normalizeProductImageForDb(null), '');
  });

  it('keeps an https address', () => {
    assert.equal(
      normalizeProductImageForDb('https://cdn.example.com/fan.jpg'),
      'https://cdn.example.com/fan.jpg'
    );
  });

  it('refuses an unknown path shape', () => {
    assert.throws(() => normalizeProductImageForDb('images/fan.jpg'), /store\/assets\/catalog/);
  });
});

describe('resolveCatalogImageUrl', () => {
  it('leaves a full address alone', () => {
    assert.equal(
      resolveCatalogImageUrl('https://cdn.example.com/fan.jpg'),
      'https://cdn.example.com/fan.jpg'
    );
  });

  it('maps the store path to the API URL', () => {
    process.env.PUBLIC_API_ORIGIN = 'http://localhost:5001';
    assert.equal(
      resolveCatalogImageUrl('store/assets/catalog/Fans/fan.jpg'),
      'http://localhost:5001/store/assets/catalog/Fans/fan.jpg'
    );
    delete process.env.PUBLIC_API_ORIGIN;
  });

  it('maps a gallery-style assets path', () => {
    process.env.PUBLIC_API_ORIGIN = 'http://localhost:5001';
    assert.equal(
      resolveCatalogImageUrl('assets/catalog/Wires/wire.webp'),
      'http://localhost:5001/store/assets/catalog/Wires/wire.webp'
    );
    delete process.env.PUBLIC_API_ORIGIN;
  });

  it('returns null for a blank path', () => {
    assert.equal(resolveCatalogImageUrl(''), null);
    assert.equal(resolveCatalogImageUrl(null), null);
  });
});

describe('resolveCatalogGallery', () => {
  it('resolves a JSON array of paths', () => {
    process.env.PUBLIC_API_ORIGIN = 'http://localhost:5001';
    assert.deepEqual(resolveCatalogGallery('["assets/catalog/Wires/a.webp"]'), [
      'http://localhost:5001/store/assets/catalog/Wires/a.webp',
    ]);
    delete process.env.PUBLIC_API_ORIGIN;
  });

  it('returns an empty list when the gallery is blank', () => {
    assert.deepEqual(resolveCatalogGallery(''), []);
    assert.deepEqual(resolveCatalogGallery(null), []);
  });
});
