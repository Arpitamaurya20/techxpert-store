/**
 * Live store API (docs/APP_TEAM_HANDOVER.md):
 *   EXPO_PUBLIC_API_BASE_URL=https://store.jiotechxpert.com/api
 *
 * Every platform calls this host directly. Expo web in a browser also needs
 * the API's CORS_ORIGINS to include the page origin.
 */
const rawBaseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').trim();

export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');

export const isApiConfigured = /^https?:\/\/.+/i.test(API_BASE_URL);

export const REQUEST_TIMEOUT_MS = 15_000;
