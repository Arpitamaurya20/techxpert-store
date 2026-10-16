import { getAuthToken } from '@/state/sessionStore';

import { API_BASE_URL, REQUEST_TIMEOUT_MS, isApiConfigured } from './apiConfig';

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

function buildUrl(path: string, params?: QueryParams) {
  const query = Object.entries(params ?? {})
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return `${API_BASE_URL}${path}${query ? `?${query}` : ''}`;
}

/** GET request to the Techxpert API. Sends the session token as a Bearer header when signed in. */
export async function apiGet(path: string, params?: QueryParams): Promise<unknown> {
  if (!isApiConfigured) {
    throw new ApiError('NOT_CONFIGURED', 'The Techxpert store server is not connected yet.');
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(buildUrl(path, params), { headers, signal: controller.signal });
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

  if (response.status === 401 || response.status === 403) {
    throw new ApiError('UNAUTHORIZED', 'Please sign in again to continue.', response.status);
  }
  if (response.status === 404) {
    throw new ApiError('NOT_FOUND', 'We could not find what you were looking for.', 404);
  }
  if (!response.ok) {
    throw new ApiError(
      'SERVER',
      'Something went wrong on our side. Please try again shortly.',
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
  if (error instanceof ApiError) return error.message;
  return 'Something went wrong. Please try again.';
}
