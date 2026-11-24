/**
 * Store customer API base URL (docs/STORE_CUSTOMER_API.md).
 *
 * Green (test):  https://apitest.jiotechxpert.com/api
 * Blue (prod):   https://store.jiotechxpert.com/api
 *
 * Routes also work without `/api`. Prefer `/api` so paths match the guides.
 * Every platform calls this host directly. Expo web needs CORS_ORIGINS to
 * include the page origin.
 */
const rawBaseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').trim();

export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');

export const isApiConfigured = /^https?:\/\/.+/i.test(API_BASE_URL);

export const REQUEST_TIMEOUT_MS = 15_000;
