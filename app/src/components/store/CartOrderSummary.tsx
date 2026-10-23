import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, spacing, typography } from '@/constants/theme';
import type { CartTotals } from '@/state/cartStore';
import { formatPrice } from '@/utils/format';

type CartOrderSummaryProps = {
  subtotal: number;
  itemCount: number;
  lineCount: number;
  /** Server totals. Null while a change is being saved, or when no server is connected. */
  totals: CartTotals | null;
  connected: boolean;
};

function Row({ label, value, tone }: { label: string; value: string; tone?: 'saving' }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.amount, tone === 'saving' && styles.saving]}>{value}</Text>
    </View>
  );
}

/** Shows only amounts the server has confirmed; without them, just the subtotal. */
export function CartOrderSummary({ subtotal, itemCount, lineCount, totals, connected }: CartOrderSummaryProps) {
  const countLabel =
    lineCount === itemCount
      ? `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`
      : `${lineCount} ${lineCount === 1 ? 'product' : 'products'} · ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;

  return (
    <View style={styles.card}>
      <Text style={styles.title} accessibilityRole="header">
        Order Summary
      </Text>
      {totals ? (
        <>
          <Row label={`Subtotal (${countLabel})`} value={formatPrice(totals.subtotal)} />
          {totals.bulkSavings > 0 ? (
            <Row label="Bulk savings (included)" value={`− ${formatPrice(totals.bulkSavings)}`} tone="saving" />
          ) : null}
          <Row label="Delivery" value={totals.delivery === 0 ? 'Free' : formatPrice(totals.delivery)} />
          <Row label="GST (18%)" value={formatPrice(totals.tax)} />
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.value}>{formatPrice(totals.grandTotal)}</Text>
          </View>
          <Text style={styles.note}>Prices and stock are checked again when you place the order.</Text>
        </>
      ) : (
        <>
          <View style={styles.row}>
            <Text style={styles.label}>Subtotal ({countLabel})</Text>
            <Text style={styles.value}>{formatPrice(subtotal)}</Text>
          </View>
          <Text style={styles.note}>
            {connected
              ? 'Updating prices…'
              : 'Delivery, tax and any other charges will be calculated at checkout. Prices and stock are confirmed then. A payable total is not shown until those amounts are known.'}
          </Text>
        </>
      )}
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
  amount: {
    ...typography.body,
    fontFamily: fonts.semiBold,
    color: colors.text,
  },
  saving: {
    color: colors.success,
  },
  divider: {
    height: 1,
    backgroundColor: colors.cardBorder,
    marginVertical: spacing.xs,
  },
  totalLabel: {
    ...typography.label,
    flex: 1,
    fontSize: 16,
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
