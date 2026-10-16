import type { IdentifierType } from '@/utils/validation';

import { API_BASE_URL, REQUEST_TIMEOUT_MS, isApiConfigured } from './apiConfig';

/**
 * Authentication API service (placeholder contract).
 *
 * The Techxpert authentication API is not available yet. Until it is, every
 * sign-in attempt fails with a `NOT_CONFIGURED` error — there is no fake
 * success. Once the backend exists, set `EXPO_PUBLIC_API_BASE_URL` and make
 * sure the server implements (or this file is adjusted to match):
 *
 *   POST {API_BASE_URL}/auth/login
 *   Request body:  { "identifier": "9876543210" | "name@example.com",
 *                    "identifierType": "mobile" | "email",
 *                    "password": "..." }
 *   200 response:  { "token": "<access token>", "user": { "id": "...", "name"?: "...",
 *                    "email"?: "...", "mobile"?: "...",
 *                    "deliveryLocation"?: { "pincode": "560001", "city": "Bengaluru" } } }
 *   400 / 401:     wrong credentials
 *   429:           too many attempts
 *   5xx:           server problem
 *
 * The password is sent once over HTTPS and is never stored or logged by the app.
 */

export type AuthErrorCode =
  | 'NOT_CONFIGURED'
  | 'INVALID_CREDENTIALS'
  | 'TOO_MANY_ATTEMPTS'
  | 'NETWORK'
  | 'TIMEOUT'
  | 'SERVER';

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

export type SignInRequest = {
  identifier: string;
  identifierType: IdentifierType;
  password: string;
};

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

function isSignInResponse(data: unknown): data is SignInResponse {
  if (typeof data !== 'object' || data === null) return false;
  const { token, user } = data as Record<string, unknown>;
  return (
    typeof token === 'string' &&
    token.length > 0 &&
    typeof user === 'object' &&
    user !== null &&
    typeof (user as Record<string, unknown>).id === 'string'
  );
}

export async function signIn(request: SignInRequest): Promise<SignInResponse> {
  if (!isApiConfigured) {
    throw new AuthError(
      'NOT_CONFIGURED',
      'Sign-in is not available yet because the Techxpert server has not been connected to this app.'
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(request),
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

  if (response.status === 400 || response.status === 401) {
    throw new AuthError(
      'INVALID_CREDENTIALS',
      'The mobile number/email or password you entered is incorrect.'
    );
  }

  if (response.status === 429) {
    throw new AuthError(
      'TOO_MANY_ATTEMPTS',
      'Too many sign-in attempts. Please wait a few minutes and try again.'
    );
  }

  if (!response.ok) {
    throw new AuthError('SERVER', 'Something went wrong on our side. Please try again shortly.');
  }

  const data: unknown = await response.json().catch(() => null);
  if (!isSignInResponse(data)) {
    throw new AuthError('SERVER', 'We received an unexpected response. Please try again shortly.');
  }

  return data;
}

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof AuthError) return error.message;
  return 'Something went wrong. Please try again.';
}
