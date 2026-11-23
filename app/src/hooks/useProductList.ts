import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getProducts } from '@/services/productApi';
import type { Product, ProductQuery } from '@/types/catalog';

/** Card-list page size — matches Store API card default; keeps first paint fast. */
export const PRODUCT_PAGE_SIZE = 20;

export type ProductListQuery = {
  search?: string;
  categoryId?: string;
  brandId?: string;
  featured?: boolean;
  limit?: number;
};

type ProductListState = {
  status: 'loading' | 'success' | 'error';
  items: Product[];
  error?: unknown;
  source?: 'api' | 'demo';
  hasMore: boolean;
  nextAfter?: string | number;
  loadingMore: boolean;
  isRefreshing: boolean;
  /** True while a new query is loading but previous items are still shown. */
  isUpdating: boolean;
};

function stableKey(query: ProductListQuery): string {
  return JSON.stringify({
    search: query.search ?? null,
    categoryId: query.categoryId ?? null,
    brandId: query.brandId ?? null,
    featured: query.featured === true,
    limit: query.limit ?? PRODUCT_PAGE_SIZE,
  });
}

function appendUnique(existing: Product[], incoming: Product[]): Product[] {
  if (incoming.length === 0) return existing;
  if (existing.length === 0) return incoming;
  const seen = new Set(existing.map((product) => product.id));
  const merged = existing.slice();
  for (const product of incoming) {
    if (seen.has(product.id)) continue;
    seen.add(product.id);
    merged.push(product);
  }
  return merged;
}

/**
 * Cursor-paged product cards for phone lists.
 * First page uses `view=card&total=false`; later pages pass `after=meta.nextAfter`.
 */
export function useProductList(query: ProductListQuery) {
  const pageSize = query.limit ?? PRODUCT_PAGE_SIZE;
  const key = stableKey({ ...query, limit: pageSize });

  const apiQuery = useMemo<ProductQuery>(
    () => ({
      search: query.search || undefined,
      categoryId: query.categoryId || undefined,
      brandId: query.brandId || undefined,
      featured: query.featured === true ? true : undefined,
      limit: pageSize,
      view: 'card',
      total: false,
    }),
    [query.search, query.categoryId, query.brandId, query.featured, pageSize]
  );

  const [state, setState] = useState<ProductListState>({
    status: 'loading',
    items: [],
    hasMore: false,
    loadingMore: false,
    isRefreshing: false,
    isUpdating: false,
  });

  const requestIdRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const nextAfterRef = useRef<string | number | undefined>(undefined);
  const hasMoreRef = useRef(false);
  const apiQueryRef = useRef(apiQuery);

  useEffect(() => {
    apiQueryRef.current = apiQuery;
  }, [apiQuery]);

  useEffect(() => {
    nextAfterRef.current = state.nextAfter;
    hasMoreRef.current = state.hasMore;
  }, [state.nextAfter, state.hasMore]);

  const loadFirstPage = useCallback(async (mode: 'load' | 'refresh') => {
    const requestId = ++requestIdRef.current;
    loadingMoreRef.current = false;

    setState((current) => {
      if (mode === 'refresh') {
        return { ...current, isRefreshing: true, loadingMore: false };
      }
      if (current.status === 'success' && current.items.length > 0) {
        return { ...current, isUpdating: true, loadingMore: false };
      }
      return {
        status: 'loading',
        items: [],
        hasMore: false,
        nextAfter: undefined,
        loadingMore: false,
        isRefreshing: false,
        isUpdating: false,
      };
    });

    try {
      const page = await getProducts(apiQueryRef.current);
      if (requestId !== requestIdRef.current) return;

      const hasMore = page.meta?.hasMore === true && page.meta.nextAfter != null;
      nextAfterRef.current = hasMore ? page.meta?.nextAfter : undefined;
      hasMoreRef.current = hasMore;

      setState({
        status: 'success',
        items: page.data,
        source: page.source,
        hasMore,
        nextAfter: hasMore ? page.meta?.nextAfter : undefined,
        loadingMore: false,
        isRefreshing: false,
        isUpdating: false,
      });
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      nextAfterRef.current = undefined;
      hasMoreRef.current = false;
      setState({
        status: 'error',
        items: [],
        error,
        hasMore: false,
        nextAfter: undefined,
        loadingMore: false,
        isRefreshing: false,
        isUpdating: false,
      });
    }
  }, []);

  useEffect(() => {
    loadFirstPage('load');
    return () => {
      requestIdRef.current += 1;
    };
  }, [key, loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (!hasMoreRef.current || loadingMoreRef.current) return;
    const after = nextAfterRef.current;
    if (after == null) return;

    const requestId = requestIdRef.current;
    loadingMoreRef.current = true;
    setState((current) => ({ ...current, loadingMore: true }));

    try {
      const page = await getProducts({ ...apiQueryRef.current, after });
      if (requestId !== requestIdRef.current) return;

      const hasMore = page.meta?.hasMore === true && page.meta.nextAfter != null;
      nextAfterRef.current = hasMore ? page.meta?.nextAfter : undefined;
      hasMoreRef.current = hasMore;

      setState((current) => ({
        ...current,
        status: 'success',
        items: appendUnique(current.items, page.data),
        source: page.source,
        hasMore,
        nextAfter: hasMore ? page.meta?.nextAfter : undefined,
        loadingMore: false,
        error: undefined,
      }));
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      // Keep already-loaded pages; allow retry on next scroll.
      hasMoreRef.current = true;
      setState((current) => ({
        ...current,
        loadingMore: false,
        error,
      }));
    } finally {
      if (requestId === requestIdRef.current) loadingMoreRef.current = false;
    }
  }, []);

  const reload = useCallback(() => loadFirstPage('load'), [loadFirstPage]);
  const refresh = useCallback(() => loadFirstPage('refresh'), [loadFirstPage]);

  return {
    ...state,
    reload,
    refresh,
    loadMore,
  };
}
