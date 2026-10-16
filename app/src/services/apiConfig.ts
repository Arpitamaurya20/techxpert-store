/**
 * The backend URL is read from the `EXPO_PUBLIC_API_BASE_URL` environment
 * variable (see `.env.example`). Values prefixed with `EXPO_PUBLIC_` are
 * bundled into the app and visible to anyone, so never put secrets here.
 */
const rawBaseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').trim();

export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');

export const isApiConfigured = /^https?:\/\/.+/i.test(API_BASE_URL);

export const REQUEST_TIMEOUT_MS = 15_000;
