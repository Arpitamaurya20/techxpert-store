/** Which customer app placed the order. Staff orders and older rows have none. */
export const ORDER_CHANNELS = ['store_app', 'homecare_app'] as const;
export type OrderChannel = (typeof ORDER_CHANNELS)[number];

export function readOrderChannel(value: unknown, fallback: OrderChannel): OrderChannel {
  if (value == null || value === '') return fallback;
  if (value === 'store_app' || value === 'homecare_app') return value;
  throw Object.assign(new Error('The app is the store app or the home-service app.'), { statusCode: 400 });
}
