import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { MAX_STORE_WIDTH, SCREEN_PADDING, colors, spacing, typography } from '@/constants/theme';
import { formatPrice, lineSubtotal } from '@/utils/format';

type AddToCartBarProps = {
  price?: number;
  canAdd: boolean;
  quantity: number;
  onAdd: () => void;
  blockedTitle: string;
  blockedMessage?: string;
  onLayout?: (event: LayoutChangeEvent) => void;
};

/** Sticky purchase button; it sits above the system navigation using the safe-area inset. */
export function AddToCartBar({
  price,
  canAdd,
  quantity,
  onAdd,
  blockedTitle,
  blockedMessage,
  onLayout,
}: AddToCartBarProps) {
  const insets = useSafeAreaInsets();
  const title =
    canAdd && price !== undefined && quantity > 1
      ? `Add to Cart · ${formatPrice(lineSubtotal(price, quantity))}`
      : canAdd
        ? 'Add to Cart'
        : blockedTitle;

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + spacing.md }]} onLayout={onLayout}>
      <View style={styles.inner}>
        {!canAdd && blockedMessage ? (
          <View style={styles.blocked} accessibilityLiveRegion="polite">
            <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
            <Text style={styles.blockedText}>{blockedMessage}</Text>
          </View>
        ) : null}
        <Button
          title={title}
          icon={canAdd ? 'cart-outline' : undefined}
          disabled={!canAdd}
          onPress={onAdd}
          accessibilityHint={canAdd ? `Adds ${quantity} to your cart` : undefined}
        />
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
});
