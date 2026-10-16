import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, spacing, typography } from '@/constants/theme';
import { formatPrice } from '@/utils/format';

type CartOrderSummaryProps = {
  subtotal: number;
  itemCount: number;
  lineCount: number;
};

/**
 * Shows only amounts the app can honestly compute. Delivery, tax and discounts
 * are omitted until a checkout / pricing API returns them.
 */
export function CartOrderSummary({ subtotal, itemCount, lineCount }: CartOrderSummaryProps) {
  const countLabel =
    lineCount === itemCount
      ? `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`
      : `${lineCount} ${lineCount === 1 ? 'product' : 'products'} · ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;

  return (
    <View style={styles.card}>
      <Text style={styles.title} accessibilityRole="header">
        Order Summary
      </Text>
      <View style={styles.row}>
        <Text style={styles.label}>Subtotal ({countLabel})</Text>
        <Text style={styles.value}>{formatPrice(subtotal)}</Text>
      </View>
      <Text style={styles.note}>
        Delivery, tax and any other charges will be calculated at checkout. Prices and stock are
        confirmed then. A payable total is not shown until those amounts are known.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  title: {
    ...typography.label,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.md,
  },
  label: {
    ...typography.body,
    flex: 1,
    color: colors.text,
  },
  value: {
    ...typography.sectionTitle,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  note: {
    ...typography.small,
    color: colors.textMuted,
  },
});
