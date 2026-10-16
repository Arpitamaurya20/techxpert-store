import { useCallback, useEffect, useRef, useState } from 'react';

type AsyncState<T> = {
  status: 'loading' | 'success' | 'error';
  data?: T;
  error?: unknown;
  isRefreshing: boolean;
  /** True while `keepPreviousData` is showing old results for a new key. */
  isUpdating: boolean;
};

type UseAsyncDataOptions = {
  /** Keep showing the last results while a new key loads (e.g. search-as-you-type). */
  keepPreviousData?: boolean;
};

/**
 * Loads data for a screen and tracks loading / error / refresh state.
 * The request runs again whenever `key` changes; results from older
 * requests are ignored so fast typing or navigation cannot show stale data.
 * `force` is true for "Try Again" and pull-to-refresh so cached loaders fetch again.
 */
export function useAsyncData<T>(
  key: string,
  loader: (options: { force: boolean }) => Promise<T>,
  { keepPreviousData = false }: UseAsyncDataOptions = {}
) {
  const [state, setState] = useState<AsyncState<T>>({
    status: 'loading',
    isRefreshing: false,
    isUpdating: false,
  });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const keepPreviousRef = useRef(keepPreviousData);
  keepPreviousRef.current = keepPreviousData;
  const requestIdRef = useRef(0);

  const run = useCallback(async (mode: 'load' | 'refresh', force: boolean) => {
    const requestId = ++requestIdRef.current;
    setState((current) => {
      if (mode === 'refresh') return { ...current, isRefreshing: true };
      if (keepPreviousRef.current && current.status === 'success') {
        return { ...current, isUpdating: true };
      }
      return { status: 'loading', isRefreshing: false, isUpdating: false };
    });
    try {
      const data = await loaderRef.current({ force });
      if (requestId === requestIdRef.current) {
        setState({ status: 'success', data, isRefreshing: false, isUpdating: false });
      }
    } catch (error) {
      if (requestId === requestIdRef.current) {
        setState({ status: 'error', error, isRefreshing: false, isUpdating: false });
      }
    }
  }, []);

  useEffect(() => {
    run('load', false);
    return () => {
      requestIdRef.current++;
    };
  }, [key, run]);

  const reload = useCallback(() => run('load', true), [run]);
  const refresh = useCallback(() => run('refresh', true), [run]);

  return { ...state, reload, refresh };
}
