import crypto from 'crypto';

/** Portal staff tokens carry this audience; anything else (customer, old `adminId`, Homecare) is not staff. */
export const STAFF_TOKEN_AUDIENCE = 'store-portal';

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 128;

/** `store`: own email and password in portal_staff. `linked`: signs in with a Homecare login. */
export type StaffKind = 'store' | 'linked';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: unknown): string | null {
  const email = String(raw ?? '').trim().toLowerCase();
  if (!email || email.length > 190 || !EMAIL_PATTERN.test(email)) return null;
  return email;
}

export function cleanStaffName(raw: unknown): string | null {
  const name = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 120) return null;
  return name;
}

/** Why a new password is refused, or null when it is fine. */
export function passwordProblem(password: string, context: { email?: string; current?: string } = {}): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > MAX_PASSWORD_LENGTH) return `Use at most ${MAX_PASSWORD_LENGTH} characters.`;
  if (!password.trim()) return 'A password of only spaces is not allowed.';
  if (context.email && password.trim().toLowerCase() === context.email.toLowerCase()) {
    return "Don't use your email as your password.";
  }
  if (context.current !== undefined && password === context.current) {
    return 'Choose a password different from the current one.';
  }
  return null;
}

/** No 0/O/o, 1/l/I: it is read off a screen and typed by hand. */
const TEMP_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

export function temporaryPassword(length = 12): string {
  let out = '';
  for (let i = 0; i < length; i += 1) out += TEMP_ALPHABET[crypto.randomInt(TEMP_ALPHABET.length)];
  return out;
}

/**
 * True when a token predates the last password change, so it must be refused.
 * PasswordChangedAt is stored to the second and `iat` is in seconds; a token issued in the
 * same second as the change survives, which is what keeps the session of the person who changed it.
 */
export function issuedBeforePasswordChange(iat: unknown, changedAt: Date | null): boolean {
  if (!changedAt) return false;
  const issued = Number(iat);
  if (!Number.isFinite(issued)) return true;
  return issued < Math.floor(changedAt.getTime() / 1000);
}

/** The staff id from verified JWT claims, or null when the token is not a portal staff token. */
export function staffIdFromClaims(claims: unknown): number | null {
  if (!claims || typeof claims !== 'object') return null;
  const { aud, staffId } = claims as { aud?: unknown; staffId?: unknown };
  const audiences = Array.isArray(aud) ? aud : [aud];
  if (!audiences.includes(STAFF_TOKEN_AUDIENCE)) return null;
  const id = Number(staffId);
  return Number.isInteger(id) && id > 0 ? id : null;
}
