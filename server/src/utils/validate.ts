/** Lightweight request-body guards for merchandising writes (L4). */

export function badRequest(message: string): never {
  throw Object.assign(new Error(message), { statusCode: 400 });
}

export function requireString(value: unknown, field: string, opts?: { max?: number; min?: number }) {
  if (typeof value !== 'string' || !value.trim()) {
    badRequest(`${field} is required`);
  }
  const s = value.trim();
  if (opts?.min !== undefined && s.length < opts.min) {
    badRequest(`${field} must be at least ${opts.min} characters`);
  }
  if (opts?.max !== undefined && s.length > opts.max) {
    badRequest(`${field} must be at most ${opts.max} characters`);
  }
  return s;
}

export function optionalString(value: unknown, field: string, opts?: { max?: number }) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') badRequest(`${field} must be a string`);
  const s = value.trim();
  if (opts?.max !== undefined && s.length > opts.max) {
    badRequest(`${field} must be at most ${opts.max} characters`);
  }
  return s;
}

export function requireNumber(value: unknown, field: string, opts?: { min?: number; max?: number }) {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    badRequest(`${field} must be a number`);
  }
  if (opts?.min !== undefined && n < opts.min) badRequest(`${field} must be ≥ ${opts.min}`);
  if (opts?.max !== undefined && n > opts.max) badRequest(`${field} must be ≤ ${opts.max}`);
  return n;
}

export function optionalNumber(value: unknown, field: string, opts?: { min?: number; max?: number }) {
  if (value === undefined || value === null || value === '') return undefined;
  return requireNumber(value, field, opts);
}

const BANNER_STATUSES = new Set(['draft', 'published', 'scheduled', 'paused', 'archived']);
const CTA_TYPES = new Set(['category', 'product', 'external', 'deals', 'url']);

export function assertHttpOrPathUrl(value: string, field: string) {
  const v = value.trim();
  if (v.startsWith('/')) return v;
  try {
    const u = new URL(v);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      badRequest(`${field} must be http(s) or a path starting with /`);
    }
    return v;
  } catch {
    badRequest(`${field} must be a valid URL or path starting with /`);
  }
}

export function validateProductCreateBody(body: any) {
  const name = requireString(body?.name, 'name', { max: 500 });
  const categoryId = body?.categoryId;
  if (categoryId === undefined || categoryId === null || categoryId === '') {
    badRequest('categoryId is required');
  }
  const price = requireNumber(body?.price, 'price', { min: 0 });
  const stockQuantity = optionalNumber(body?.stockQuantity, 'stockQuantity', { min: 0 }) ?? 100;
  const unit = optionalString(body?.unit, 'unit', { max: 100 }) || '1 unit';
  const description = optionalString(body?.description, 'description', { max: 5000 });
  const sku = optionalString(body?.sku, 'sku', { max: 100 });
  const brandName = optionalString(body?.brandName ?? body?.brandId, 'brandName', { max: 255 });
  return { ...body, name, categoryId, price, stockQuantity, unit, description, sku, brandName };
}

/** Fields left out stay as they are. `price: null` removes the price; an empty or null `brandName` clears it. */
export function validateProductUpdateBody(body: any) {
  const next = { ...(body ?? {}) };
  if (body?.name !== undefined) requireString(body.name, 'name', { max: 500 });
  if (body?.price !== undefined && body.price !== null) {
    if (body.price === '') badRequest('price must be a number, or null to remove it');
    const price = requireNumber(body.price, 'price');
    if (!(price > 0)) badRequest('Price must be more than ₹0.');
    next.price = price;
  }
  if (body?.brandName !== undefined) {
    next.brandName = optionalString(body.brandName, 'brandName', { max: 255 }) || null;
  }
  if (body?.stockQuantity !== undefined) requireNumber(body.stockQuantity, 'stockQuantity', { min: 0 });
  if (body?.unit !== undefined) optionalString(body.unit, 'unit', { max: 100 });
  if (body?.description !== undefined) optionalString(body.description, 'description', { max: 5000 });
  return next;
}

export const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function validateOrderStatusBody(body: any): { status: OrderStatus; note?: string } {
  const status = requireString(body?.status, 'status');
  if (!(ORDER_STATUSES as readonly string[]).includes(status)) {
    badRequest(`status must be one of: ${ORDER_STATUSES.join(', ')}`);
  }
  const note = optionalString(body?.note, 'note', { max: 500 }) || undefined;
  return { status: status as OrderStatus, note };
}

export function validateBannerBody(body: any, partial = false) {
  if (!partial || body?.title !== undefined) {
    requireString(body?.title, 'title', { max: 255 });
  }
  if (!partial || body?.imageUrl !== undefined) {
    const imageUrl = requireString(body?.imageUrl, 'imageUrl', { max: 1000 });
    assertHttpOrPathUrl(imageUrl, 'imageUrl');
  }
  if (body?.ctaLabel !== undefined) optionalString(body.ctaLabel, 'ctaLabel', { max: 80 });
  if (body?.ctaType !== undefined) {
    const t = requireString(body.ctaType, 'ctaType');
    if (!CTA_TYPES.has(t)) badRequest(`ctaType must be one of: ${[...CTA_TYPES].join(', ')}`);
  }
  if (body?.status !== undefined) {
    const s = requireString(body.status, 'status');
    if (!BANNER_STATUSES.has(s)) badRequest(`status must be one of: ${[...BANNER_STATUSES].join(', ')}`);
  }
  if (body?.ctaTarget !== undefined) optionalString(body.ctaTarget, 'ctaTarget', { max: 500 });
  const startsAt = optionalInstant(body?.startsAt, 'startsAt');
  const endsAt = optionalInstant(body?.endsAt, 'endsAt');
  if (startsAt && endsAt && new Date(endsAt).getTime() < new Date(startsAt).getTime()) {
    badRequest('endsAt must be on or after startsAt');
  }
  const next = { ...(body ?? {}) };
  if (body?.startsAt !== undefined) next.startsAt = startsAt ?? null;
  if (body?.endsAt !== undefined) next.endsAt = endsAt ?? null;
  return next;
}

function optionalInstant(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const raw = requireString(value, field, { max: 40 });
  const ms = new Date(raw).getTime();
  if (Number.isNaN(ms)) badRequest(`${field} must be a date-time`);
  return new Date(ms).toISOString();
}

export function validateBulkTierBody(body: any, partial = false) {
  if (!partial && (body?.productId === undefined || body?.productId === null || body?.productId === '')) {
    badRequest('productId is required');
  }
  if (partial && body?.productId !== undefined && (body.productId === null || body.productId === '')) {
    badRequest('productId is required');
  }
  if (!partial || body?.minQty !== undefined || body?.min_quantity !== undefined) {
    requireNumber(body?.minQty ?? body?.min_quantity, 'minQty', { min: 1 });
  }
  if (!partial || body?.discountValue !== undefined || body?.discount_value !== undefined) {
    requireNumber(body?.discountValue ?? body?.discount_value, 'discountValue', { min: 0 });
  }
  let maxQty: number | null | undefined;
  if (body?.maxQty !== undefined || body?.max_quantity !== undefined) {
    const raw = body.maxQty ?? body.max_quantity;
    maxQty = raw === null || raw === '' ? null : requireNumber(raw, 'maxQty', { min: 1 });
  }
  const minRaw = body?.minQty ?? body?.min_quantity;
  if (maxQty != null && minRaw != null && maxQty < Number(minRaw)) {
    badRequest('maxQty must be at least minQty');
  }
  if (body?.discountType !== undefined) {
    const t = requireString(body.discountType, 'discountType');
    if (t !== 'percentage' && t !== 'fixed_price') {
      badRequest('discountType must be percentage or fixed_price');
    }
  }
  return maxQty !== undefined ? { ...body, maxQty } : body;
}

/** Absolute URL for relative banner assets so mobile can load them (L5). */
export function resolveAssetUrl(url: string | null | undefined): string {
  const raw = String(url || '').trim();
  if (!raw) return raw;
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) return raw;
  if (!raw.startsWith('/')) return raw;

  // Uploads are served by the API. Do not prefix them with the website origin.
  if (raw.startsWith('/uploads/')) {
    const apiOrigin = (process.env.PUBLIC_API_ORIGIN || '').trim().replace(/\/$/, '');
    if (!apiOrigin) return raw;
    return `${apiOrigin}${raw}`;
  }

  const base = (
    process.env.ASSET_BASE_URL ||
    process.env.PUBLIC_WEB_ORIGIN ||
    process.env.VITE_PUBLIC_ORIGIN ||
    ''
  )
    .trim()
    .replace(/\/$/, '');
  if (!base) return raw;
  return `${base}${raw}`;
}
