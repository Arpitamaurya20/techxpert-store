import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The server-issued key for this device's guest cart. Only the server makes it;
 * the app keeps whatever the last cart reply said.
 */
const KEY = 'techxpert.cartSession';

let loaded: Promise<string | undefined> | null = null;

export function loadCartSessionId(): Promise<string | undefined> {
  loaded ??= AsyncStorage.getItem(KEY)
    .then((value) => value ?? undefined)
    .catch(() => undefined);
  return loaded;
}

export function saveCartSessionId(id: string) {
  loaded = Promise.resolve(id);
  AsyncStorage.setItem(KEY, id).catch(() => undefined);
}
