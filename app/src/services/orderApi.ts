import { getAuthToken } from '@/state/sessionStore';
import { accountCartLinked } from '@/state/cartLink';
import type { Order, OrderItem, OrderStatus } from '@/types/order';

import { ApiError, apiGet, apiPost } from './apiClient';
import { isApiConfigured } from './apiConfig';
import { isPayUEnabled } from './apiConfig';
import { checkoutTransport } from './cartAuthPolicy';
import { cartHeaders } from './cartApi';
import { asId, asList, asNumber, asRecord, asText, normalizeList } from './normalize';

/**
 * Order history service.
 *
 * Endpoint the backend needs to provide (GET, JSON, requires the signed-in
 * user's Bearer token; may return an array or `{ "data": [...] }`):
 *
 *   /orders
 *       → [{ id, orderNumber?, placedAt? (or createdAt), status?, total?,
 *            items: [{ productId, name, quantity, unitPrice? (or price),
 *                      unit?, imageUrl?, categoryId? }] }]
 *         Newest first. `status` is one of "pending" | "confirmed" | "processing" |
 *         "shipped" | "delivered" | "cancelled"; any other value is shown as sent.
 *
 * There is no demo order history: without a server the app shows the empty
 * "Reordering will be easy" state rather than invented orders.
 */

export type OrdersResult =
  | { state: 'not_connected' }
  | { state: 'signed_out' }
  | { state: 'ready'; orders: Order[] };

const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
];

function normalizeOrderItem(raw: unknown): OrderItem | null {
  const record = asRecord(raw);
  const product = asRecord(record?.product);
  const productId = asId(record?.productId) ?? asId(product?.id);
  const name = asText(record?.name) ?? asText(product?.name);
  const quantity = asNumber(record?.quantity);
  if (!record || !productId || !name || !quantity) return null;

  return {
    productId,
    name,
    quantity: Math.floor(quantity),
    unitPrice: asNumber(record.unitPrice ?? record.price),
    unit: asText(record.unit) ?? asText(product?.unit),
    imageUrl: asText(record.imageUrl) ?? asText(product?.imageUrl),
    categoryId: asId(record.categoryId) ?? asId(product?.categoryId),
  };
}

function normalizeOrder(raw: unknown): Order | null {
  const record = asRecord(raw);
  const id = asId(record?.id);
  if (!record || !id) return null;

  const rawStatus = asText(record.status)?.toLowerCase().replace(/[\s-]+/g, '_');
  const status = ORDER_STATUSES.find((value) => value === rawStatus);
  const placedAt = asText(record.placedAt) ?? asText(record.createdAt);
  let items: OrderItem[] = [];
  try {
    items = asList(record.items ?? []).map(normalizeOrderItem).filter((item) => item !== null);
  } catch {
    items = [];
  }

  return {
    id,
    orderNumber: asText(record.orderNumber) ?? asId(record.orderNumber) ?? id,
    placedAt: placedAt && !Number.isNaN(Date.parse(placedAt)) ? placedAt : undefined,
    status,
    statusLabel: status ? undefined : asText(record.status),
    items,
    total: asNumber(record.total ?? record.totalAmount ?? record.grandTotal),
  };
}

export type PaymentMethod = 'COD' | 'PayU';

export type PlaceOrderInput = {
  /** The server cart being ordered; repeating the request with it returns the same order. */
  cartId: string | null;
  /** The total the customer saw. The server refuses the order if its own total differs. */
  expectedTotal: number;
  customerName: string;
  mobile: string;
  address: { line: string; city: string; pincode: string };
  /** Signed-in saved address from GET /auth/addresses — preferred over shippingAddress text. */
  addressId?: string;
  paymentMethod: PaymentMethod;
  /** Optional; same key + body replays checkout (docs/STORE_CUSTOMER_API.md). */
  idempotencyKey?: string;
};

/** What the server confirmed; its totals include delivery and tax, so they may differ from the cart. */
export type PlacedOrder = {
  id: string;
  orderNumber: string;
  total?: number;
  shippingCharges?: number;
  placedAt?: string;
  paymentMethod?: string;
  paymentStatus?: string;
};

function parsePlacedOrder(raw: unknown): PlacedOrder {
  const envelope = asRecord(raw);
  const record = asRecord(envelope?.data) ?? envelope;
  const id = asId(record?.id);
  if (!record || !id) {
    throw new ApiError(
      'INVALID_RESPONSE',
      'We could not confirm your order. Please check My Orders before trying again.'
    );
  }
  const totals = asRecord(record.totals);
  return {
    id,
    orderNumber: asText(record.orderNumber) ?? asId(record.orderNumber) ?? id,
    total: asNumber(totals?.grandTotal ?? record.total ?? record.grandTotal),
    shippingCharges: asNumber(totals?.delivery ?? record.shippingCharges),
    placedAt: asText(record.placedAt),
    paymentMethod: asText(record.paymentMethod),
    paymentStatus: asText(record.paymentStatus),
  };
}

function isGuestCartAuthConflict(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 403 || error.status === 401) &&
    /not authorized to access this cart|sign in to pay online|foreign key|CARTS_USERID_FK/i.test(
      error.message
    )
  );
}

/**
 * Places an order from the server cart (POST /cart/checkout).
 *
 * Signed-in customers send the Store JWT and the account cart id, with no guest
 * session. Guests send `x-session-id` and pay cash on delivery. PayU requires the JWT.
 */
export async function placeOrder(input: PlaceOrderInput): Promise<PlacedOrder> {
  const { line, city, pincode } = input.address;
  const signedIn = Boolean(getAuthToken());
  if (input.paymentMethod === 'PayU' && !isPayUEnabled) {
    throw new ApiError(
      'SERVER',
      'Pay online is temporarily unavailable on the test API. Please use cash on delivery.',
      403
    );
  }

  const transport = checkoutTransport({
    paymentMethod: input.paymentMethod,
    signedIn,
    accountLinked: accountCartLinked(),
    cartId: input.cartId,
  });
  if ('error' in transport) {
    throw new ApiError('UNAUTHORIZED', transport.error, 401);
  }

  const headers: Record<string, string> = transport.sendSession ? { ...(await cartHeaders()) } : {};
  if (input.idempotencyKey) headers['Idempotency-Key'] = input.idempotencyKey;

  const shippingAddress = `${line}, ${city} - ${pincode}`;
  const body: Record<string, unknown> = {
    ...(transport.cartId ? { cartId: Number(transport.cartId) || transport.cartId } : {}),
    expectedTotal: input.expectedTotal,
    paymentMethod: input.paymentMethod,
    pincode,
    shippingAddress,
    ...(input.addressId ? { addressId: Number(input.addressId) || input.addressId } : {}),
    guestName: input.customerName,
    guestPhone: input.mobile,
  };

  try {
    return parsePlacedOrder(
      await apiPost('/cart/checkout', body, { headers, skipAuth: !transport.sendJwt })
    );
  } catch (error) {
    if (input.paymentMethod === 'PayU' && isGuestCartAuthConflict(error)) {
      throw new ApiError(
        'SERVER',
        'Pay online needs the account cart. Retry moving your cart to your account, then try again.',
        403
      );
    }
    throw error;
  }
}

export async function getOrders(): Promise<OrdersResult> {
  if (!isApiConfigured) return { state: 'not_connected' };
  if (!getAuthToken()) return { state: 'signed_out' };

  try {
    const raw = await apiGet('/orders');
    return { state: 'ready', orders: normalizeList(raw, normalizeOrder) };
  } catch (error) {
    if (error instanceof ApiError && error.code === 'UNAUTHORIZED') return { state: 'signed_out' };
    throw error;
  }
}
