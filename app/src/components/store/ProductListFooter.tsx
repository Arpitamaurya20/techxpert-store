import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/constants/theme';

type ProductListFooterProps = {
  loadingMore: boolean;
  hasMore: boolean;
  loadedCount: number;
};

/** Footer under product grids: load-more spinner or a quiet “end of loaded pages” note. */
export function ProductListFooter({ loadingMore, hasMore, loadedCount }: ProductListFooterProps) {
  if (loadedCount === 0) return null;

  if (loadingMore) {
    return (
      <View style={styles.row} accessibilityRole="progressbar" accessibilityLabel="Loading more products">
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={styles.label}>Loading more…</Text>
      </View>
    );
  }

  if (hasMore) {
    return (
      <View style={styles.row}>
        <Text style={styles.label}>Scroll for more</Text>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Text style={styles.label}>
        Showing {loadedCount} {loadedCount === 1 ? 'product' : 'products'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
