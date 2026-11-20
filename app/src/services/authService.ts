import { API_BASE_URL, REQUEST_TIMEOUT_MS, isApiConfigured } from './apiConfig';
import { asRecord, asText } from './normalize';

/**
 * Customer sign-in (docs/APP_API_GUIDE.md UC-7).
 *
 * Production uses OTP only:
 *   POST /auth/send-otp   { phone }
 *   POST /auth/verify-otp { phone, otp, name?, email? } → { token, user }
 *
 * `POST /auth/login` is a local API shortcut and is refused in production — do not call it from the app.
 */

export type AuthErrorCode =
  | 'NOT_CONFIGURED'
  | 'INVALID_CREDENTIALS'
  | 'TOO_MANY_ATTEMPTS'
  | 'NETWORK'
  | 'TIMEOUT'
  | 'SERVER'
  | 'VALIDATION';

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

export type AuthUser = {
  id: string;
  name?: string;
  email?: string;
  mobile?: string;
  /** The account's saved delivery location, if the backend stores one. */
  deliveryLocation?: { pincode: string; city: string };
};

export type SignInResponse = {
  token: string;
  user: AuthUser;
};

export type SendOtpResponse = {
  phone: string;
  message: string;
  /** Present only on a local API; never shown in production UI. */
  devOtp?: string;
};

function isSignInResponse(data: unknown): data is SignInResponse {
  if (typeof data !== 'object' || data === null) return false;
  const { token, user } = data as Record<string, unknown>;
  if (typeof token !== 'string' || token.length === 0) return false;
  if (typeof user !== 'object' || user === null) return false;
  const id = (user as Record<string, unknown>).id;
  return typeof id === 'string' || typeof id === 'number';
}

function normalizeUser(raw: Record<string, unknown>): AuthUser {
  const location = asRecord(raw.deliveryLocation);
  const pincode = asText(location?.pincode);
  const city = asText(location?.city);
  return {
    id: String(raw.id),
    name: asText(raw.name),
    email: asText(raw.email),
    mobile: asText(raw.mobile) ?? asText(raw.phone),
    deliveryLocation: pincode && city ? { pincode, city } : undefined,
  };
}

async function authFetch(path: string, body: unknown): Promise<Response> {
  if (!isApiConfigured) {
    throw new AuthError(
      'NOT_CONFIGURED',
      'Sign-in is not available yet because the Techxpert server has not been connected to this app.'
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) {
      throw new AuthError('TIMEOUT', 'The server took too long to respond. Please try again.');
    }
    throw new AuthError(
      'NETWORK',
      'We could not reach the server. Check your internet connection and try again.'
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

async function readErrorMessage(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { error?: unknown; message?: unknown };
    const message = typeof body.error === 'string' ? body.error : body.message;
    return typeof message === 'string' && message.trim() ? message.trim() : undefined;
  } catch {
    return undefined;
  }
}

/** Ask the server to text a one-time code to this 10-digit Indian mobile number. */
export async function sendOtp(phone: string): Promise<SendOtpResponse> {
  const response = await authFetch('/auth/send-otp', { phone });

  if (response.status === 400) {
    throw new AuthError(
      'VALIDATION',
      (await readErrorMessage(response)) ?? 'Enter a valid 10-digit mobile number.'
    );
  }
  if (response.status === 429) {
    throw new AuthError(
      'TOO_MANY_ATTEMPTS',
      (await readErrorMessage(response)) ?? 'Too many attempts. Please wait a few minutes and try again.'
    );
  }
  if (response.status === 503) {
    throw new AuthError(
      'SERVER',
      (await readErrorMessage(response)) ??
        'The sign-in code could not be sent. Ask for a new one.'
    );
  }
  if (!response.ok) {
    throw new AuthError(
      'SERVER',
      (await readErrorMessage(response)) ?? 'Something went wrong on our side. Please try again shortly.'
    );
  }

  const data: unknown = await response.json().catch(() => null);
  const record = asRecord(data);
  const payload = asRecord(record?.data) ?? record;
  const resolvedPhone = asText(payload?.phone) ?? phone;
  const message =
    asText(payload?.message) ?? asText(record?.message) ?? 'OTP sent successfully';
  const devOtp = asText(payload?.devOtp);

  return { phone: resolvedPhone, message, ...(devOtp ? { devOtp } : {}) };
}

/** Verify the one-time code and return the customer session. */
export async function verifyOtp(input: {
  phone: string;
  otp: string;
  name?: string;
  email?: string;
}): Promise<SignInResponse> {
  const body: Record<string, string> = { phone: input.phone, otp: input.otp };
  if (input.name?.trim()) body.name = input.name.trim();
  if (input.email?.trim()) body.email = input.email.trim();

  const response = await authFetch('/auth/verify-otp', body);

  if (response.status === 400) {
    throw new AuthError(
      'VALIDATION',
      (await readErrorMessage(response)) ?? 'Phone and OTP are required.'
    );
  }
  if (response.status === 401) {
    throw new AuthError(
      'INVALID_CREDENTIALS',
      (await readErrorMessage(response)) ??
        'That code is wrong or has expired. Ask for a new one.'
    );
  }
  if (response.status === 409) {
    throw new AuthError(
      'VALIDATION',
      (await readErrorMessage(response)) ?? 'That email is already on another account.'
    );
  }
  if (response.status === 429) {
    throw new AuthError(
      'TOO_MANY_ATTEMPTS',
      (await readErrorMessage(response)) ?? 'Too many attempts. Please wait a few minutes and try again.'
    );
  }
  if (!response.ok) {
    throw new AuthError(
      'SERVER',
      (await readErrorMessage(response)) ?? 'Something went wrong on our side. Please try again shortly.'
    );
  }

  const data: unknown = await response.json().catch(() => null);
  if (!isSignInResponse(data)) {
    throw new AuthError('SERVER', 'We received an unexpected response. Please try again shortly.');
  }

  const userRecord = data.user as unknown as Record<string, unknown>;
  return { token: data.token, user: normalizeUser(userRecord) };
}

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof AuthError) return error.message;
  return 'Something went wrong. Please try again.';
}
