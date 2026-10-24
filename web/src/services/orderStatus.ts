import type { BadgeVariant } from '../components/ui/Badge';

/** Statuses staff can set, in fulfilment order. */
export const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'] as const;

const LABELS: Record<string, string> = {
  pending: 'Pending',
  placed: 'Placed',
  confirmed: 'Confirmed',
  processing: 'Processing',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const orderStatusLabel = (status: string | null | undefined): string => {
  const key = String(status || '').toLowerCase();
  if (!key) return 'Not recorded';
  return LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
};

/** Still needs work from the store: anything not delivered or cancelled. */
export const isOpenOrder = (status: string | null | undefined): boolean => {
  const key = String(status || '').toLowerCase();
  return key !== 'delivered' && key !== 'cancelled';
};

/** Mirrors the server (`server/src/utils/orderRules.ts`): cancelled is final; a delivered order can't be cancelled. */
export const statusChoices = (current: string): readonly string[] => {
  if (current === 'cancelled') return ['cancelled'];
  if (current === 'delivered') return ORDER_STATUSES.filter((s) => s !== 'cancelled');
  return ORDER_STATUSES;
};

/** Mirrors the server: only orders placed through this shop (`TX-ORD-`) took stock, so only they get it back. */
export const restocksOnCancel = (orderNumber: string | null | undefined): boolean =>
  String(orderNumber || '').startsWith('TX-ORD-');

export const orderStatusVariant = (status: string | null | undefined): BadgeVariant => {
  const key = String(status || '').toLowerCase();
  if (key === 'delivered') return 'success';
  if (key === 'cancelled') return 'danger';
  if (key === 'shipped') return 'info';
  return 'warning';
};

export const orderSourceLabel = (source: string | null | undefined): string => {
  if (source === 'staff') return 'Staff';
  if (source === 'request') return 'Talk to us';
  return 'App';
};

export const paymentMethodLabel = (method: string | null | undefined): string | null => {
  const key = String(method || '').trim();
  if (!key) return null;
  return key.toUpperCase() === 'COD' ? 'Cash on delivery' : key;
};

export const paymentStatusLabel = (status: string | null | undefined): string | null => {
  const key = String(status || '').toLowerCase();
  if (!key) return null;
  if (key === 'paid') return 'Paid';
  if (key === 'pending') return 'Not paid yet';
  return key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
};
