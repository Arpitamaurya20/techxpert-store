import { readOrderChannel, type OrderChannel } from './orderChannel.js';

/**
 * Exchange tokens carrying `channel` win; body `channel` is ignored then.
 * Store Expo (no token channel) keeps body / default `store_app`.
 */
export function resolveCheckoutChannel(input: {
  tokenChannel?: OrderChannel | string | null;
  bodyChannel?: unknown;
}): OrderChannel {
  if (input.tokenChannel === 'homecare_app' || input.tokenChannel === 'store_app') {
    return input.tokenChannel;
  }
  return readOrderChannel(input.bodyChannel, 'store_app');
}
