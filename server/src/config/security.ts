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

/**
 * Local-only opt-in to fall back to server/database.json when MySQL fails.
 * Default OFF so portal never silently serves seed catalog as live data.
 */
export function isFileStoreAllowed(): boolean {
  if (isProduction()) return false;
  return process.env.ALLOW_FILE_STORE === '1';
}

export function getCorsOptions(): { origin: string[] | boolean; credentials?: boolean } {
  const raw = process.env.CORS_ORIGINS?.trim();

  if (isProduction()) {
    if (!raw) {
      throw new Error(
        'FATAL: CORS_ORIGINS must be set in production (comma-separated allowlist, e.g. https://admin.example.com)'
      );
    }
    const origins = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (origins.length === 0) {
      throw new Error('FATAL: CORS_ORIGINS is empty after parsing');
    }
    return { origin: origins, credentials: true };
  }

  if (!raw) {
    // Local: permissive (Vite + Expo)
    return { origin: true, credentials: true };
  }

  return {
    origin: raw.split(',').map((s) => s.trim()).filter(Boolean),
    credentials: true,
  };
}
