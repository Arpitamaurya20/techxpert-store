/** An order request the customer must change; never a reason to fall back to the file store. */
export function orderRefusal(statusCode: number, message: string): Error {
  return Object.assign(new Error(message), { statusCode });
}

export function isOrderRefusal(err: unknown): boolean {
  const status = Number((err as { statusCode?: unknown } | null)?.statusCode);
  return status >= 400 && status < 500;
}

export const ORDER_FAILED_MESSAGE = "We couldn't place your order. Your cart is unchanged.";

/** A database failure while placing an order: never a pretend order. */
export function orderFailed(): Error {
  return Object.assign(new Error(ORDER_FAILED_MESSAGE), { statusCode: 503 });
}

/**
 * Who owns a guest's order. An unregistered 10-digit phone gets a new unverified customer;
 * a phone that already belongs to an account stays a guest order, because the guest has not
 * proved they own that account.
 */
export function guestOrderOwner(phone: string, existingUserId: number | null): 'new_customer' | 'guest' {
  if (!/^\d{10}$/.test(phone)) return 'guest';
  return existingUserId ? 'guest' : 'new_customer';
}