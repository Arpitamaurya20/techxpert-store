import { ApiError, apiGet, apiPost } from './apiClient';
import { asId, asNumber, asRecord, asText } from './normalize';

/**
 * Store PayU (docs/APP_TEAM_PULL_BRIEF.md + APP_API_GUIDE UC-10b).
 * Order-first: checkout with paymentMethod "PayU", then initiate → WebView → verify.
 */

export type PayuPayload = {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  udf1?: string;
  udf2?: string;
  surl: string;
  furl: string;
  hash: string;
  action: string;
};

export type PayuInitiateResult = {
  orderId: string;
  txnid: string;
  amount?: number;
  payuPayload?: PayuPayload;
  checkoutHtml?: string;
};

export type OrderPaymentStatus = 'pending' | 'paid' | 'failed' | 'unknown';

export type OrderPaymentSnapshot = {
  id: string;
  orderNumber: string;
  paymentStatus: OrderPaymentStatus;
  paymentMethod?: string;
  status?: string;
  total?: number;
  placedAt?: string;
};

function normalizePayuPayload(raw: unknown): PayuPayload | undefined {
  const record = asRecord(raw);
  if (!record) return undefined;
  const key = asText(record.key);
  const txnid = asText(record.txnid);
  const amount = asText(record.amount) ?? (asNumber(record.amount) !== undefined ? String(record.amount) : undefined);
  const productinfo = asText(record.productinfo) ?? 'Order';
  const firstname = asText(record.firstname) ?? 'Customer';
  const email = asText(record.email) ?? 'customer@techxpert.store';
  const phone = asText(record.phone) ?? '';
  const surl = asText(record.surl);
  const furl = asText(record.furl);
  const hash = asText(record.hash);
  const action = asText(record.action);
  if (!key || !txnid || !amount || !surl || !furl || !hash || !action) return undefined;
  return {
    key,
    txnid,
    amount,
    productinfo,
    firstname,
    email,
    phone,
    udf1: asText(record.udf1),
    udf2: asText(record.udf2),
    surl,
    furl,
    hash,
    action,
  };
}

/** Builds a self-submitting HTML form when the API does not send checkout_html. */
export function buildPayuCheckoutHtml(payload: PayuPayload): string {
  const fields = [
    'key',
    'txnid',
    'amount',
    'productinfo',
    'firstname',
    'email',
    'phone',
    'surl',
    'furl',
    'hash',
    'udf1',
    'udf2',
  ] as const;
  const inputs = fields
    .map((name) => {
      const value = payload[name];
      if (value === undefined || value === '') return '';
      const escaped = String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
      return `<input type="hidden" name="${name}" value="${escaped}" />`;
    })
    .join('');
  const action = payload.action.replace(/"/g, '&quot;');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>PayU</title></head><body><p style="font-family:sans-serif;text-align:center;margin-top:40px;color:#0B2A5B">Opening secure payment…</p><form id="payu" method="post" action="${action}">${inputs}</form><script>document.getElementById('payu').submit();</script></body></html>`;
}

export async function initiatePayuPayment(orderId: string): Promise<PayuInitiateResult> {
  const raw = await apiPost('/payments/payu/initiate', { orderId, client: 'app' });
  const envelope = asRecord(raw);
  const data = asRecord(envelope?.data) ?? envelope;
  const id = asId(data?.orderId) ?? orderId;
  const txnid = asText(data?.txnid);
  if (!data || !txnid) {
    throw new ApiError('INVALID_RESPONSE', 'We could not start online payment. Please try again.');
  }
  const payuPayload = normalizePayuPayload(data.payuPayload);
  const checkoutHtml = asText(data.checkout_html) ?? asText(data.checkoutHtml);
  if (!checkoutHtml && !payuPayload) {
    throw new ApiError('INVALID_RESPONSE', 'Online payment did not return a PayU form. Please try again.');
  }
  return {
    orderId: id,
    txnid,
    amount: asNumber(data.amount),
    payuPayload,
    checkoutHtml: checkoutHtml ?? (payuPayload ? buildPayuCheckoutHtml(payuPayload) : undefined),
  };
}

export async function verifyPayuPayment(orderId: string): Promise<OrderPaymentSnapshot> {
  await apiPost('/payments/payu/verify', { orderId });
  return getOrderPaymentSnapshot(orderId);
}

function normalizePaymentStatus(raw: unknown): OrderPaymentStatus {
  const text = asText(raw)?.toLowerCase();
  if (text === 'paid' || text === 'success' || text === 'captured') return 'paid';
  if (text === 'failed' || text === 'failure' || text === 'cancelled' || text === 'canceled') return 'failed';
  if (text === 'pending' || text === 'initiated') return 'pending';
  return 'unknown';
}

export async function getOrderPaymentSnapshot(orderId: string): Promise<OrderPaymentSnapshot> {
  const raw = await apiGet(`/orders/${encodeURIComponent(orderId)}`);
  const envelope = asRecord(raw);
  const record = asRecord(envelope?.data) ?? envelope;
  const id = asId(record?.id) ?? orderId;
  if (!record) {
    throw new ApiError('INVALID_RESPONSE', 'We could not load this order.');
  }
  const totals = asRecord(record.totals);
  return {
    id,
    orderNumber: asText(record.orderNumber) ?? asId(record.orderNumber) ?? id,
    paymentStatus: normalizePaymentStatus(record.paymentStatus),
    paymentMethod: asText(record.paymentMethod),
    status: asText(record.status),
    total: asNumber(totals?.grandTotal ?? record.total ?? record.grandTotal),
    placedAt: asText(record.placedAt),
  };
}

/** True when the WebView landed on Store PayU success/failure callbacks. */
export function isPayuReturnUrl(url: string): 'success' | 'failure' | null {
  const lower = url.toLowerCase();
  if (lower.includes('/payments/payu/success') || lower.includes('/api/payments/payu/success')) {
    return 'success';
  }
  if (lower.includes('/payments/payu/failure') || lower.includes('/api/payments/payu/failure')) {
    return 'failure';
  }
  return null;
}
