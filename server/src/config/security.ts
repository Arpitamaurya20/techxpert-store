/**
 * Shared security helpers for JWT, CORS, and portal bootstrap.
 */

const INSECURE_DEFAULT = 'techxpert-store-secret-key-2026';

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();

  if (isProduction()) {
    if (!secret || secret === INSECURE_DEFAULT || secret.length < 24) {
      throw new Error(
        'FATAL: JWT_SECRET must be set to a strong unique value (min 24 chars) when NODE_ENV=production'
      );
    }
    return secret;
  }

  if (!secret) {
    console.warn(
      '[security] JWT_SECRET unset — using insecure local default. Set JWT_SECRET before any shared/staging deploy.'
    );
    return INSECURE_DEFAULT;
  }

  return secret;
}

/**
 * Local seed admin (admin@techxpert.in / admin123).
 * Opt-in only: set ALLOW_DEV_ADMIN=1. Always disabled in production.
 */
export function isDevAdminAllowed(): boolean {
  if (isProduction()) return false;
  return process.env.ALLOW_DEV_ADMIN === '1';
}

/** The one-time code every phone gets outside production; `send-otp` also returns it as `devOtp`. */
export const DEV_OTP = '123456';

/**
 * Local customer sign-in shortcuts: the fixed code `DEV_OTP` and identifier-only `POST /auth/login`.
 * Both let anyone sign in as any customer, so they are always off in production.
 */
export function isDevCustomerLoginAllowed(): boolean {
  return !isProduction();
}

/**
 * Local-only opt-in to fall back to server/database.json when MySQL fails.
 * Default OFF so portal never silently serves seed catalog as live data.
 */
export function isFileStoreAllowed(): boolean {
  if (isProduction()) return false;
  return process.env.ALLOW_FILE_STORE === '1';
}

/** Expo web / Vite / local tools — browsers send these as Origin on cross-origin API calls. */
const LOCAL_DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

const CORS_ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'Accept',
  'X-Session-Id',
  'x-session-id',
];

export type AppCorsOptions = {
  origin: boolean | string[] | ((origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => void);
  credentials: true;
  allowedHeaders: string[];
  methods: string[];
  maxAge: number;
};

/**
 * CORS for every API route (mounted once in index.ts).
 * Production still requires CORS_ORIGINS for real hosts; localhost / 127.0.0.1
 * (any port) are also allowed so Expo web and the Vite portal can call the API.
 */
export function getCorsOptions(): AppCorsOptions {
  const raw = process.env.CORS_ORIGINS?.trim();
  const fromEnv = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [];

  if (isProduction() && fromEnv.length === 0) {
    throw new Error(
      'FATAL: CORS_ORIGINS must be set in production (comma-separated allowlist, e.g. https://store.jiotechxpert.com)'
    );
  }

  const allowSet = new Set(fromEnv);

  const shared = {
    credentials: true as const,
    allowedHeaders: CORS_ALLOWED_HEADERS,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    maxAge: 86400,
  };

  if (!isProduction() && allowSet.size === 0) {
    // Local API: reflect any Origin (Expo + Vite).
    return { ...shared, origin: true };
  }

  return {
    ...shared,
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowSet.has(origin) || LOCAL_DEV_ORIGIN.test(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
  };
}
