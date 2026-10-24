import { readTalkRequest, type TalkLineInput } from './talkRequest.js';

export const ORDER_SOURCES = ['app', 'request', 'staff'] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

export type StaffOrderInput = {
  name: string;
  phone: string;
  pincode: string;
  address: string;
  note: string | null;
  lines: TalkLineInput[];
  /** Set when the order is being placed from a Talk to us request. */
  requestId: number | null;
};

const ADDRESS_MAX = 400;

export function orderSource(value: unknown): OrderSource {
  return value === 'request' || value === 'staff' ? value : 'app';
}

/** What staff send to place an order. The cart shape matches Talk to us, plus a delivery address. */
export function readStaffOrder(body: unknown): StaffOrderInput {
  const request = readTalkRequest(body);
  const source = (body ?? {}) as Record<string, unknown>;
  const address = String(source.address ?? '').trim().replace(/\s+/g, ' ');
  if (!address) throw Object.assign(new Error('Add the delivery address.'), { statusCode: 400 });
  if (address.length > ADDRESS_MAX) {
    throw Object.assign(new Error(`The address can be ${ADDRESS_MAX} characters.`), { statusCode: 400 });
  }
  let requestId: number | null = null;
  if (source.requestId != null && source.requestId !== '') {
    requestId = Number(source.requestId);
    if (!Number.isInteger(requestId) || requestId <= 0) {
      throw Object.assign(new Error('That request was not found.'), { statusCode: 400 });
    }
  }
  return { ...request, address, requestId };
}
