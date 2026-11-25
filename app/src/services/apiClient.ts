import { clearSession, getAuthToken } from '@/state/sessionStore';

import {
  REQUEST_TIMEOUT_MS,
  baseUrlFor,
  isApiConfigured,
  shouldAttachGreenAuth,
} from './apiConfig';

export type ApiErrorCode =
  | 'NOT_CONFIGURED'
  | 'NETWORK'
  | 'TIMEOUT'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'SERVER'
  | 'INVALID_RESPONSE';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status?: number;

  constructor(code: ApiErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

type QueryParams = Record<string, string | number | boolean | undefined>;
type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';
type RequestOptions = {
  headers?: Record<string, string>;
  /** When true, never send the green JWT (guest cart checkout on green). */
  skipAuth?: boolean;
};

function buildUrl(path: string, params?: QueryParams) {
  const query = Object.entries(params ?? {})
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return `${baseUrlFor(path)}${path}${query ? `?${query}` : ''}`;
}

/** GET request. Green JWT is attached only on green-slice paths. */
export function apiGet(path: string, params?: QueryParams, options?: RequestOptions): Promise<unknown> {
  return request('GET', path, buildUrl(path, params), undefined, options);
}

/** POST JSON. Green JWT is attached only on green-slice paths. */
export function apiPost(path: string, body: unknown, options?: RequestOptions): Promise<unknown> {
  return request('POST', path, buildUrl(path), body, options);
}

export function apiPut(path: string, body: unknown, options?: RequestOptions): Promise<unknown> {
  return request('PUT', path, buildUrl(path), body, options);
}

export function apiDelete(path: string, options?: RequestOptions): Promise<unknown> {
  return request('DELETE', path, buildUrl(path), undefined, options);
}

/** The server's own explanation for a rejected request, e.g. "Insufficient stock". */
async function readErrorMessage(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { error?: unknown; message?: unknown; details?: unknown };
    const message = typeof body.error === 'string' ? body.error : body.message;
    if (__DEV__ && typeof body.details === 'string' && body.details.trim()) {
      console.warn('[api]', response.status, message, body.details.split('\n')[0]);
    }
    return typeof message === 'string' && message.trim() ? message.trim() : undefined;
  } catch {
    return undefined;
  }
}

async function request(
  method: Method,
  path: string,
  url: string,
  body?: unknown,
  options?: RequestOptions
): Promise<unknown> {
  if (!isApiConfigured) {
    throw new ApiError('NOT_CONFIGURED', 'The Techxpert store server is not connected yet.');
  }

  const headers: Record<string, string> = { ...options?.headers, Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const token = getAuthToken();
  const attachAuth = Boolean(token) && shouldAttachGreenAuth(path) && !options?.skipAuth;
  if (attachAuth && token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) {
      throw new ApiError('TIMEOUT', 'The server took too long to respond. Please try again.');
    }
    throw new ApiError(
      'NETWORK',
      'We could not reach the server. Check your internet connection and try again.'
    );
  } finally {
    clearTimeout(timeoutId);
  }

  // Invalid / expired Store JWT on GREEN → 401. Clear SecureStore so the customer must OTP again.
  if (response.status === 401) {
    if (attachAuth) clearSession();
    throw new ApiError('UNAUTHORIZED', 'Please sign in again to continue.', 401);
  }
  if (response.status === 403) {
    const message = await readErrorMessage(response);
    throw new ApiError('UNAUTHORIZED', message ?? 'You do not have access to do that.', 403);
  }
  if (response.status === 404) {
    throw new ApiError('NOT_FOUND', 'We could not find what you were looking for.', 404);
  }
  if (method !== 'GET' && response.status >= 400 && response.status < 500) {
    const message = await readErrorMessage(response);
    throw new ApiError(
      'SERVER',
      message ?? 'The server could not accept this request. Please check the details and try again.',
      response.status
    );
  }
  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new ApiError(
      'SERVER',
      message ?? 'Something went wrong on our side. Please try again shortly.',
      response.status
    );
  }

  try {
    return await response.json();
  } catch {
    throw new ApiError('INVALID_RESPONSE', 'We received an unexpected response from the server.');
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (/foreign key constraint fails|CARTS_USERID_FK|carts\.UserID/i.test(error.message)) {
      return 'Could not update your cart. Please try again in a moment.';
    }
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}
