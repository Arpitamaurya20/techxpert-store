import type { AddressLabel, SavedAddress } from '@/state/locationStore';

import { apiDelete, apiGet, apiPost, apiPut } from './apiClient';
import { asId, asRecord, asText, normalizeList } from './normalize';

/**
 * Signed-in addresses on shared Homecare identity (docs/STORE_CUSTOMER_API.md).
 * Store JWT only — Homecare exchange tokens cannot read or write these.
 *
 *   GET    /auth/addresses
 *   POST   /auth/addresses
 *   PUT    /auth/addresses/:id/default
 *   DELETE /auth/addresses/:id
 */

export type ServerAddressInput = {
  label: AddressLabel;
  /** Single line shown in the app (house / street / area). */
  line: string;
  city: string;
  pincode: string;
  isDefault?: boolean;
};

function toLine(flatNo?: string, building?: string, area?: string) {
  return [flatNo, building, area].filter(Boolean).join(', ');
}

function normalizeAddress(raw: unknown): SavedAddress | null {
  const record = asRecord(raw);
  const id = asId(record?.id);
  if (!record || !id) return null;
  const labelRaw = asText(record.label) ?? 'Home';
  const label = (['Home', 'Office', 'Other'] as const).includes(labelRaw as AddressLabel)
    ? (labelRaw as AddressLabel)
    : 'Other';
  const line =
    toLine(asText(record.flatNo), asText(record.building), asText(record.area)) ||
    asText(record.line) ||
    asText(record.address);
  const city = asText(record.city);
  const pincode = asText(record.pincode);
  if (!line || !city || !pincode) return null;
  return { id, label, line, city, pincode };
}

/** Loads the account's saved addresses (default first when the API sorts that way). */
export async function getAddresses(): Promise<SavedAddress[]> {
  const raw = await apiGet('/auth/addresses');
  return normalizeList(raw, normalizeAddress);
}

/** Creates a saved address for checkout `addressId`. */
export async function createAddress(input: ServerAddressInput): Promise<SavedAddress> {
  const raw = await apiPost('/auth/addresses', {
    label: input.label,
    flatNo: input.line,
    building: '',
    area: input.line,
    city: input.city,
    pincode: input.pincode,
    isDefault: input.isDefault === true,
  });
  const record = asRecord(raw);
  const created = normalizeAddress(asRecord(record?.data) ?? raw);
  if (!created) {
    // Fall back to a client-shaped row if the create response is thin.
    return {
      id: asId(asRecord(record?.data)?.id) ?? `local-${Date.now()}`,
      label: input.label,
      line: input.line,
      city: input.city,
      pincode: input.pincode,
    };
  }
  return created;
}

export async function setDefaultAddress(id: string): Promise<void> {
  await apiPut(`/auth/addresses/${encodeURIComponent(id)}/default`, {});
}

export async function deleteAddress(id: string): Promise<void> {
  await apiDelete(`/auth/addresses/${encodeURIComponent(id)}`);
}
