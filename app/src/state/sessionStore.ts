import type { AuthUser, SignInResponse } from '@/services/authService';

import { createStore } from './createStore';

export type Session = {
  token: string;
  user: AuthUser;
};

/**
 * The signed-in session lives in memory only, so it is cleared when the app
 * restarts. Persisting it should use expo-secure-store (never AsyncStorage
 * or plain files) once the backend's token lifetime is known.
 */
export const sessionStore = createStore<Session | null>(null);

export function setSession(response: SignInResponse) {
  sessionStore.setState({ token: response.token, user: response.user });
}

export function clearSession() {
  sessionStore.setState(null);
}

export function getAuthToken(): string | undefined {
  return sessionStore.getState()?.token;
}

export function useSession() {
  return sessionStore.useStore((session) => session);
}
