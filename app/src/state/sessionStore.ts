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

/** Load any saved session before screens that need auth run. Safe to call more than once. */
export function hydrateSession(): Promise<void> {
  if (!hydratePromise) {
    hydratePromise = readStoredSession().then((session) => {
      if (session) sessionStore.setState(session);
    });
  }
  return hydratePromise;
}

export function setSession(response: SignInResponse) {
  const session: Session = { token: response.token, user: response.user };
  sessionStore.setState(session);
  void writeStoredSession(session);
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
