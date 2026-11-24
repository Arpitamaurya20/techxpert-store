import type { OrderChannel } from './orderChannel.js';

export type ActivityStatusCode =
  | 'open'
  | 'in_progress'
  | 'done'
  | 'cancelled'
  | 'needs_attention';

export type ActivityAmountKind = 'paid' | 'cod_due' | 'payable' | 'estimate';

export type ActivityItemV1 = {
  schemaVersion: 1;
  id: string;
  domain: string;
  kind: string;
  title: string;
  statusCode: ActivityStatusCode;
  statusLabel: string;
  amountPaise: number;
  amountKind: ActivityAmountKind;
  createdAt: string;
  updatedAt: string;
  deepLink: string;
  channel: OrderChannel | null;
  nativeRef: string;
  groupRef: string | null;
};

export type StoreOrderForActivity = {
  id: number | string;
  orderNumber?: string | null;
  status?: string | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  total?: number | null;
  placedAt?: string | null;
  channel?: OrderChannel | null;
};

/** Convert rupees to integer paise once (contract: round nearest). */
export function rupeesToPaise(rupees: number): number {
  return Math.round(Number(rupees) * 100);
}

export function parseServiceOrdersCursor(
  raw: unknown
): { iso: string; orderId: number } | null {
  if (raw == null || raw === '') return null;
  const text = String(raw);
  const pipe = text.indexOf('|');
  if (pipe <= 0) return null;
  const iso = text.slice(0, pipe);
  const idPart = text.slice(pipe + 1);
  const match = /^store_order:(\d+)$/.exec(idPart);
  if (!match) return null;
  if (Number.isNaN(Date.parse(iso))) return null;
  return { iso, orderId: Number(match[1]) };
}

function statusCodeFor(status: string | null | undefined): ActivityStatusCode {
  const s = String(status || '').toLowerCase();
  if (s === 'cancelled' || s === 'canceled') return 'cancelled';
  if (s === 'delivered' || s === 'completed' || s === 'closed') return 'done';
  if (s === 'shipped' || s === 'out_for_delivery' || s === 'processing') return 'in_progress';
  if (s === 'on_hold' || s === 'problem') return 'needs_attention';
  return 'open';
}

function amountKindFor(order: StoreOrderForActivity): ActivityAmountKind {
  const method = String(order.paymentMethod || '').toUpperCase();
  const pay = String(order.paymentStatus || '').toLowerCase();
  if (method === 'COD' && pay !== 'paid') return 'cod_due';
  if (pay === 'paid') return 'paid';
  return 'payable';
}

export function mapStoreOrderToActivityItem(order: StoreOrderForActivity): ActivityItemV1 {
  const id = Number(order.id);
  const placedAt = order.placedAt || new Date(0).toISOString();
  const nativeRef = String(order.orderNumber || `TX-ORD-${id}`);
  const channel =
    order.channel === 'store_app' || order.channel === 'homecare_app' ? order.channel : null;

  return {
    schemaVersion: 1,
    id: `store_order:${id}`,
    domain: 'store',
    kind: 'store_order',
    title: 'Materials order',
    statusCode: statusCodeFor(order.status),
    statusLabel: String(order.status || 'unknown'),
    amountPaise: rupeesToPaise(Number(order.total) || 0),
    amountKind: amountKindFor(order),
    createdAt: placedAt,
    updatedAt: placedAt,
    deepLink: `techxpert://store/orders/${id}`,
    channel,
    nativeRef,
    groupRef: null,
  };
}

export function nextCursorForOrders(
  items: ActivityItemV1[]
): string | null {
  if (items.length === 0) return null;
  const last = items[items.length - 1];
  return `${last.createdAt}|${last.id}`;
}
