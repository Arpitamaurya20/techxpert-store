import { randomBytes } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import type { Request } from 'express';

export const BANNER_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

const EXT = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
} as const;

type ImageKind = keyof typeof EXT;

/** Uploaded campaign files live next to the server, not in the portal's public folder. */
export const bannerUploadRoot = path.resolve(process.cwd(), 'uploads');

export function sniffBannerImage(buf: Buffer): ImageKind | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'png';
  }
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'webp';
  }
  return null;
}

export function extractMultipartFile(body: Buffer, contentType: string, fieldName = 'file'): Buffer {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = (boundaryMatch?.[1] || boundaryMatch?.[2] || '').trim();
  if (!boundary) {
    throw Object.assign(new Error('Upload must be a multipart form'), { statusCode: 400 });
  }

  const delimiter = Buffer.from(`--${boundary}`);
  let cursor = 0;
  while (cursor < body.length) {
    const start = body.indexOf(delimiter, cursor);
    if (start < 0) break;
    let partStart = start + delimiter.length;
    if (body[partStart] === 0x2d && body[partStart + 1] === 0x2d) break;
    if (body[partStart] === 0x0d && body[partStart + 1] === 0x0a) partStart += 2;

    const headerEnd = body.indexOf(Buffer.from('\r\n\r\n'), partStart);
    if (headerEnd < 0) break;
    const headers = body.subarray(partStart, headerEnd).toString('utf8');
    const dataStart = headerEnd + 4;
    const next = body.indexOf(Buffer.from(`\r\n${delimiter.toString('utf8')}`), dataStart);
    const dataEnd = next < 0 ? body.length : next;
    const nameMatch = headers.match(/name="([^"]+)"/i) || headers.match(/name=([^;\r\n]+)/i);
    const name = (nameMatch?.[1] || '').trim();
    if (name === fieldName) return body.subarray(dataStart, dataEnd);
    cursor = dataEnd;
  }

  throw Object.assign(new Error('Choose an image file'), { statusCode: 400 });
}

export async function readBannerUpload(req: Request): Promise<Buffer> {
  const declared = Number(req.headers['content-length'] || 0);
  if (declared > BANNER_IMAGE_MAX_BYTES + 64 * 1024) {
    throw Object.assign(new Error('Image must be 2 MB or smaller'), { statusCode: 400 });
  }

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > BANNER_IMAGE_MAX_BYTES + 64 * 1024) {
      throw Object.assign(new Error('Image must be 2 MB or smaller'), { statusCode: 400 });
    }
    chunks.push(buf);
  }

  const file = extractMultipartFile(Buffer.concat(chunks), String(req.headers['content-type'] || ''));
  if (file.length === 0) {
    throw Object.assign(new Error('Choose an image file'), { statusCode: 400 });
  }
  if (file.length > BANNER_IMAGE_MAX_BYTES) {
    throw Object.assign(new Error('Image must be 2 MB or smaller'), { statusCode: 400 });
  }
  if (!sniffBannerImage(file)) {
    throw Object.assign(new Error('Image must be a JPEG, PNG, or WebP file'), { statusCode: 400 });
  }
  return file;
}

export async function storeBannerImage(bytes: Buffer): Promise<{ imageUrl: string }> {
  const kind = sniffBannerImage(bytes);
  if (!kind) {
    throw Object.assign(new Error('Image must be a JPEG, PNG, or WebP file'), { statusCode: 400 });
  }
  if (bytes.length > BANNER_IMAGE_MAX_BYTES) {
    throw Object.assign(new Error('Image must be 2 MB or smaller'), { statusCode: 400 });
  }

  const dir = path.join(bannerUploadRoot, 'banners');
  await mkdir(dir, { recursive: true });
  const name = `${randomBytes(16).toString('hex')}.${EXT[kind]}`;
  await writeFile(path.join(dir, name), bytes);
  return { imageUrl: `/uploads/banners/${name}` };
}
