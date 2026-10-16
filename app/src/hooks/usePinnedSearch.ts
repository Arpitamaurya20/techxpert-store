import { useCallback, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

/**
 * Tracks when the header's search bar has scrolled under the pinned logo bar,
 * so the screen can show a copy of it inside `StoreLogoBar`.
 */
export function usePinnedSearch() {
  const searchOffsetRef = useRef(Number.POSITIVE_INFINITY);
  const [isSearchPinned, setIsSearchPinned] = useState(false);

  const onSearchLayout = useCallback((offset: number) => {
    searchOffsetRef.current = offset;
  }, []);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIsSearchPinned(event.nativeEvent.contentOffset.y > searchOffsetRef.current);
  }, []);

  return { isSearchPinned, onSearchLayout, onScroll };
}
