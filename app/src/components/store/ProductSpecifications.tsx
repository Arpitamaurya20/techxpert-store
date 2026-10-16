import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/constants/theme';
import type { ProductSpecification } from '@/types/catalog';

type ProductSpecificationsProps = {
  items: ProductSpecification[];
};

/** Renders exactly the attributes the backend sent, as aligned label–value rows. */
export function ProductSpecifications({ items }: ProductSpecificationsProps) {
  return (
    <View style={styles.table}>
      {items.map((item, index) => (
        <View
          key={`${index}-${item.label}`}
          style={[styles.row, index > 0 && styles.rowBorder]}
          accessible
          accessibilityLabel={`${item.label}: ${item.value}`}
        >
          <Text style={styles.label}>{item.label}</Text>
          <Text style={styles.value}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  label: {
    ...typography.caption,
    flexBasis: '38%',
    flexShrink: 0,
    color: colors.textMuted,
  },
  value: {
    ...typography.caption,
    flex: 1,
    color: colors.text,
  },
});
