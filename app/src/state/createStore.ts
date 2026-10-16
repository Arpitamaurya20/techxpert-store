import { useSyncExternalStore } from 'react';

type Listener = () => void;

export type Store<T> = {
  getState: () => T;
  setState: (updater: T | ((current: T) => T)) => void;
  subscribe: (listener: Listener) => () => void;
  /**
   * Reads part of the state inside a component. The component only
   * re-renders when the selected value changes, so selectors should return
   * primitives or objects already stored in the state.
   */
  useStore: <S>(selector: (state: T) => S) => S;
};

/**
 * A tiny shared-state container. Updates are synchronous, so two quick taps
 * always see each other's changes (unlike component state).
 */
export function createStore<T>(initialState: T): Store<T> {
  let state = initialState;
  const listeners = new Set<Listener>();

  const getState = () => state;

  const setState: Store<T>['setState'] = (updater) => {
    const next =
      typeof updater === 'function' ? (updater as (current: T) => T)(state) : updater;
    if (Object.is(next, state)) return;
    state = next;
    listeners.forEach((listener) => listener());
  };

  const subscribe = (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const useStore = <S,>(selector: (state: T) => S) =>
    useSyncExternalStore(
      subscribe,
      () => selector(state),
      () => selector(state)
    );

  return { getState, setState, subscribe, useStore };
}
