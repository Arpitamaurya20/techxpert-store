import { ApiError } from './apiClient';

/** Helpers for reading untrusted JSON from the API without crashing on unexpected shapes. */

export type RawRecord = Record<string, unknown>;

export function asRecord(value: unknown): RawRecord | null {
  return typeof value === 'object' && value !== null ? (value as RawRecord) : null;
}

export function asId(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

export function asText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function asNumber(value: unknown): number | undefined {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/** Accepts a plain array, `{ data: [...] }` or `{ items: [...] }`. */
export function asList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  const record = asRecord(raw);
  if (record && Array.isArray(record.data)) return record.data;
  if (record && Array.isArray(record.items)) return record.items;
  throw new ApiError('INVALID_RESPONSE', 'We received an unexpected response from the server.');
}

/** Normalizes every entry and drops the ones that are missing required fields. */
export function normalizeList<T>(raw: unknown, normalize: (item: unknown) => T | null): T[] {
  return asList(raw)
    .map(normalize)
    .filter((item): item is T => item !== null);
}
