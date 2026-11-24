import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { AuthUser, SignInResponse } from '@/services/authService';

import { createStore } from './createStore';

export type Session = {
  token: string;
  user: AuthUser;
};

const SESSION_KEY = 'techxpert.session';

/**
 * Signed-in session. Hydrated from expo-secure-store on launch so the customer
 * stays signed in for the token's lifetime (about 30 days per the API guide).
 * Never put the token in AsyncStorage.
 */
export const sessionStore = createStore<Session | null>(null);

let hydratePromise: Promise<void> | null = null;

function canUseSecureStore() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

async function readStoredSession(): Promise<Session | null> {
  if (!canUseSecureStore()) return null;
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (typeof parsed.token !== 'string' || !parsed.token || typeof parsed.user?.id !== 'string') {
      return null;
    }
    return { token: parsed.token, user: parsed.user };
  } catch {
    return null;
  }
}

async function writeStoredSession(session: Session | null) {
  if (!canUseSecureStore()) return;
  try {
    if (!session) {
      await SecureStore.deleteItemAsync(SESSION_KEY);
      return;
    }
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Secure storage failures should not block sign-in in memory.
  }
}

/**
 * Load any saved session before screens that need auth run. Safe to call more than once.
 * When the API is configured, validates the JWT with GET /auth/me (401 clears SecureStore).
 */
export function hydrateSession(): Promise<void> {
  if (!hydratePromise) {
    hydratePromise = (async () => {
      const session = await readStoredSession();
      if (!session) return;
      sessionStore.setState(session);
      try {
        const { fetchMe } = await import('@/services/authService');
        const user = await fetchMe();
        const next = { token: session.token, user };
        sessionStore.setState(next);
        await writeStoredSession(next);
      } catch {
        // Network blips keep the cached session; 401 already cleared via apiClient.
        if (!sessionStore.getState()) return;
      }
    })();
  }
  return hydratePromise;
}

export function setSession(response: SignInResponse) {
  const session: Session = { token: response.token, user: response.user };
  sessionStore.setState(session);
  void writeStoredSession(session);
  void import('@/services/addressApi')
    .then(({ getAddresses }) => getAddresses())
    .then((addresses) => {
      void import('./locationStore').then(({ replaceAddressesFromServer }) => {
        replaceAddressesFromServer(addresses);
      });
    })
    .catch(() => {
      // Address sync is best-effort; checkout can still use shippingAddress.
    });
}

export function clearSession() {
  sessionStore.setState(null);
  void writeStoredSession(null);
}

export function getAuthToken(): string | undefined {
  return sessionStore.getState()?.token;
}

export function useSession() {
  return sessionStore.useStore((session) => session);
}
