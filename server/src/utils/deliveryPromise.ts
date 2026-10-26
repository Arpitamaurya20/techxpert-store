/** Days a new order can promise. Off until staff switch it on. */
export type DeliveryDays = { enabled: boolean; days: number | null };

const DAYS = 'Arrives in is a whole number of days, from 1 to 30.';

export function readDeliveryDays(raw: unknown): DeliveryDays {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw daysError('Arrives in must be switched on or off.');
  }
  const body = raw as { enabled?: unknown; days?: unknown };
  if (typeof body.enabled !== 'boolean') throw daysError('Arrives in must be switched on or off.');
  if (body.days == null || body.days === '') {
    if (body.enabled) throw daysError('Arrives in needs a number of days while it is switched on.');
    return { enabled: false, days: null };
  }
  const days = Number(body.days);
  if (!Number.isInteger(days) || days < 1 || days > 30) throw daysError(DAYS);
  return { enabled: body.enabled, days };
}

/** The number copied onto a new order. A switched-off promise copies nothing. */
export function deliveryPromise(days: DeliveryDays): number | null {
  return days.enabled && days.days != null ? days.days : null;
}

export function arrivesSentence(days: number | null | undefined): string | null {
  if (days == null || !Number.isInteger(days) || days < 1) return null;
  return days === 1 ? 'Arrives in 1 day.' : `Arrives in ${days} days.`;
}

function daysError(message: string): Error {
  return Object.assign(new Error(message), { statusCode: 400 });
}
