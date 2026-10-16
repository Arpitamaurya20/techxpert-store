import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { MAX_STORE_WIDTH, SCREEN_PADDING, colors, fonts, spacing, typography } from '@/constants/theme';
import type { AddableRange } from '@/state/cartStore';
import { formatPrice, lineSubtotal } from '@/utils/format';

import { QuantitySelector } from './QuantitySelector';

type AddToCartBarProps = {
  productName: string;
  price?: number;
  /** Null when nothing more can be added; `blockedMessage` explains why. */
  range: AddableRange | null;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  onAdd: () => void;
  blockedTitle: string;
  blockedMessage?: string;
  onLayout?: (event: LayoutChangeEvent) => void;
};

/** Sticky purchase bar; it sits above the system navigation using the safe-area inset. */
export function AddToCartBar({
  productName,
  price,
  range,
  quantity,
  onQuantityChange,
  onAdd,
  blockedTitle,
  blockedMessage,
  onLayout,
}: AddToCartBarProps) {
  const insets = useSafeAreaInsets();
  const canAdd = range !== null;

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + spacing.md }]} onLayout={onLayout}>
      <View style={styles.inner}>
        {canAdd && price !== undefined ? (
          <View
            style={styles.summary}
            accessible
            accessibilityLabel={`Subtotal ${formatPrice(lineSubtotal(price, quantity))}`}
          >
            <Text style={styles.summaryLabel}>
              {quantity} × {formatPrice(price)}
            </Text>
            <Text style={styles.summaryValue}>Subtotal {formatPrice(lineSubtotal(price, quantity))}</Text>
          </View>
        ) : null}

        {!canAdd && blockedMessage ? (
          <View style={styles.blocked} accessibilityLiveRegion="polite">
            <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
            <Text style={styles.blockedText}>{blockedMessage}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          {canAdd ? (
            <QuantitySelector
              value={quantity}
              min={range.min}
              max={range.max}
              step={range.step}
              onChange={onQuantityChange}
              itemName={productName}
            />
          ) : null}
          <View style={styles.button}>
            <Button
              title={canAdd ? 'Add to Cart' : blockedTitle}
              icon={canAdd ? 'cart-outline' : undefined}
              disabled={!canAdd}
              onPress={onAdd}
              accessibilityHint={canAdd ? `Adds ${quantity} to your cart` : undefined}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing.md,
    paddingHorizontal: SCREEN_PADDING,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: MAX_STORE_WIDTH - SCREEN_PADDING * 2,
    gap: spacing.sm,
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  summaryValue: {
    ...typography.label,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  blocked: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  blockedText: {
    ...typography.caption,
    flex: 1,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  button: {
    flex: 1,
    maxWidth: 420,
  },
});
