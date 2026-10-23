import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractMultipartFile, sniffBannerImage } from './bannerMedia.js';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);

describe('sniffBannerImage', () => {
  it('accepts jpeg, png, and webp signatures', () => {
    assert.equal(sniffBannerImage(Buffer.from([0xff, 0xd8, 0xff, 0x00])), 'jpeg');
    assert.equal(sniffBannerImage(PNG), 'png');
    const webp = Buffer.alloc(12);
    webp.write('RIFF', 0);
    webp.write('WEBP', 8);
    assert.equal(sniffBannerImage(webp), 'webp');
  });

  it('rejects a file that is not one of those images', () => {
    assert.equal(sniffBannerImage(Buffer.from('not an image')), null);
    assert.equal(sniffBannerImage(Buffer.from('<svg></svg>')), null);
  });
});

describe('extractMultipartFile', () => {
  it('returns the file field bytes', () => {
    const body = Buffer.from(
      `--bound\r\nContent-Disposition: form-data; name="file"; filename="hero.png"\r\nContent-Type: image/png\r\n\r\n${PNG.toString('binary')}\r\n--bound--\r\n`,
      'binary',
    );
    const file = extractMultipartFile(body, 'multipart/form-data; boundary=bound');
    assert.equal(sniffBannerImage(file), 'png');
  });
});
