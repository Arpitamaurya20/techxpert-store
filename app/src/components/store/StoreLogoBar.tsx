import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand/BrandMark';
import { MAX_STORE_WIDTH, MIN_TOUCH_TARGET, SCREEN_PADDING, colors, radius, spacing } from '@/constants/theme';

const SEARCH_AREA_HEIGHT = MIN_TOUCH_TARGET + spacing.md;

type StoreLogoBarProps = {
  /** Search bar to pin under the logo once the header's own search has scrolled away. */
  search?: ReactNode;
  showSearch?: boolean;
};

/**
 * Logo strip above `StoreHeader`; screens pin it with `stickyHeaderIndices`.
 * The search area is always reserved but pulled up with a negative margin, so
 * showing it never shifts the page content.
 */
export function StoreLogoBar({ search, showSearch = false }: StoreLogoBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={search ? styles.withSearch : null}>
      <View style={[styles.bar, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.logoChip}>
          <BrandMark size="small" />
        </View>
      </View>
      {search ? (
        <View style={[styles.searchArea, !showSearch && styles.searchAreaHidden]}>
          {showSearch ? <View style={styles.searchInner}>{search}</View> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  withSearch: {
    marginBottom: -SEARCH_AREA_HEIGHT,
    pointerEvents: 'box-none',
  },
  bar: {
    alignItems: 'center',
    paddingBottom: spacing.sm,
    backgroundColor: colors.homePink,
  },
  logoChip: {
    height: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
  },
  searchArea: {
    height: SEARCH_AREA_HEIGHT,
    alignItems: 'center',
    paddingHorizontal: SCREEN_PADDING,
    backgroundColor: colors.homePink,
  },
  searchAreaHidden: {
    backgroundColor: 'transparent',
    pointerEvents: 'none',
  },
  searchInner: {
    width: '100%',
    maxWidth: MAX_STORE_WIDTH - SCREEN_PADDING * 2,
  },
});
