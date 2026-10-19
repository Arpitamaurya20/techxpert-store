import AsyncStorage from '@react-native-async-storage/async-storage';

import { createStore, type Store } from './createStore';

/**
 * A `createStore` that is saved on the device and restored on launch.
 * `parse` must reject anything that is not valid saved state.
 */
export function createPersistentStore<T>(
  key: string,
  initialState: T,
  parse: (saved: unknown) => T | undefined
): Store<T> {
  const store = createStore(initialState);
  let restored = false;

  AsyncStorage.getItem(key)
    .then((raw) => {
      if (raw === null) return;
      const saved = parse(JSON.parse(raw));
      // Anything changed before the saved copy arrived wins over the saved copy.
      if (saved !== undefined && store.getState() === initialState) store.setState(saved);
    })
    .catch(() => undefined)
    .finally(() => {
      restored = true;
    });

  store.subscribe(() => {
    if (!restored && store.getState() === initialState) return;
    AsyncStorage.setItem(key, JSON.stringify(store.getState())).catch(() => undefined);
  });

  return store;
}

export function parseStringList(saved: unknown): string[] | undefined {
  return Array.isArray(saved) && saved.every((item) => typeof item === 'string') ? saved : undefined;
}
