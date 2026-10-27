import { randomBytes } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { BANNER_IMAGE_MAX_BYTES, sniffBannerImage } from './bannerMedia.js';

/**
 * Files on disk live at server/catalog/catalog/<folder>/<file>.
 * The database stores store/assets/catalog/<folder>/<file>, so the public URL
 * keeps that prefix and the API serves the folder under it.
 * Resolved from the process working directory (run the API from `server/`).
 */
export const catalogImageRoot = path.resolve(process.cwd(), 'catalog/catalog');

export const CATALOG_PUBLIC_PREFIX = '/store/assets/catalog';

const EXT = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
} as const;

function apiOrigin(): string {
  const fromEnv = (process.env.PUBLIC_API_ORIGIN || '').trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === 'production') return '';
  const port = process.env.PORT || '5001';
  return `http://localhost:${port}`;
}

/**
 * Value written to products.ProductImage.
 * Empty clears the picture. Full https stays. Store paths keep the prod shape
 * store/assets/catalog/... (no leading slash).
 */
export function normalizeProductImageForDb(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (value === null) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/store/assets/catalog/')) return raw.slice(1);
  if (raw.startsWith('store/assets/catalog/')) return raw;
  throw Object.assign(
    new Error('Use an https:// address, a store/assets/catalog/… path, or clear the picture.'),
    { statusCode: 400 }
  );
}

/** Save a staff upload under catalog/catalog/staff/<productId>/ and return the DB path. */
export async function storeProductImage(productId: number, bytes: Buffer): Promise<{ imageUrl: string }> {
  if (!Number.isInteger(productId) || productId <= 0) {
    throw Object.assign(new Error('Product not found'), { statusCode: 404 });
  }
  const kind = sniffBannerImage(bytes);
  if (!kind) {
    throw Object.assign(new Error('Image must be a JPEG, PNG, or WebP file'), { statusCode: 400 });
  }
  if (bytes.length > BANNER_IMAGE_MAX_BYTES) {
    throw Object.assign(new Error('Image must be 2 MB or smaller'), { statusCode: 400 });
  }
  const dir = path.join(catalogImageRoot, 'staff', String(productId));
  await mkdir(dir, { recursive: true });
  const name = `${randomBytes(16).toString('hex')}.${EXT[kind]}`;
  await writeFile(path.join(dir, name), bytes);
  return { imageUrl: `store/assets/catalog/staff/${productId}/${name}` };
}

/** Turn a stored product/category path into a URL the portal and phone can load. */
export function resolveCatalogImageUrl(url: string | null | undefined): string | null {
  const raw = String(url ?? '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) return raw;

  let publicPath = raw;
  if (raw.startsWith('store/assets/catalog/')) {
    publicPath = `/${raw}`;
  } else if (raw.startsWith('assets/catalog/')) {
    publicPath = `/store/${raw}`;
  } else if (raw.startsWith('/store/assets/catalog/')) {
    publicPath = raw;
  } else if (!raw.startsWith('/')) {
    // Bare relative file under the catalog tree.
    publicPath = `${CATALOG_PUBLIC_PREFIX}/${raw.replace(/^\.?\//, '')}`;
  } else {
    return raw;
  }

  const encoded = encodeURI(publicPath);
  const origin = apiOrigin();
  return origin ? `${origin}${encoded}` : encoded;
}

function parseGalleryList(gallery: unknown): unknown[] {
  if (Array.isArray(gallery)) return gallery;
  if (typeof gallery !== 'string' || !gallery.trim()) return [];
  try {
    let parsed: unknown = JSON.parse(gallery);
    // Some imported rows store a JSON string that itself holds the array.
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** ProductGallery is a JSON text blob of paths; empty or bad JSON becomes []. */
export function resolveCatalogGallery(gallery: unknown): string[] {
  const urls: string[] = [];
  for (const item of parseGalleryList(gallery)) {
    const pathValue =
      typeof item === 'string'
        ? item
        : item && typeof item === 'object' && 'url' in item
          ? String((item as { url: unknown }).url)
          : '';
    const resolved = resolveCatalogImageUrl(pathValue);
    if (resolved) urls.push(resolved);
  }
  return urls;
}
