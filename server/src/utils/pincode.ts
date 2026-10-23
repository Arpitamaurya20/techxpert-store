/** An Indian PIN code: six digits, not starting with 0. */
export function normalizePincode(raw: unknown): string | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/\s+/g, '');
  return /^[1-9]\d{5}$/.test(digits) ? digits : null;
}

/** The pincode an order is delivered to: the explicit field, else the last one in the address. */
export function deliveryPincode(explicit: unknown, address: string | null | undefined): string | null {
  const direct = normalizePincode(explicit);
  if (direct) return direct;
  const matches = String(address || '').match(/(?<!\d)[1-9]\d{5}(?!\d)/g);
  return matches ? matches[matches.length - 1] : null;
}

/** `areas.AreaCode` is VARCHAR(10) and unique per district, so a new area is keyed by its pincode. */
export function areaCodeFor(pincode: string): string {
  return `P${pincode}`;
}
