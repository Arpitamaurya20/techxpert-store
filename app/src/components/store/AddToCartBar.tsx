import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { MAX_STORE_WIDTH, SCREEN_PADDING, colors, spacing, typography } from '@/constants/theme';

type AddToCartBarProps = {
  canAdd: boolean;
  /** Buy Now stays available when the item is already in the cart, even if no more can be added. */
  canBuy: boolean;
  quantity: number;
  onAdd: () => void;
  onBuyNow: () => void;
  blockedTitle: string;
  blockedMessage?: string;
  onLayout?: (event: LayoutChangeEvent) => void;
};

/** Sticky Add to Cart / Buy Now buttons; they sit above the system navigation using the safe-area inset. */
export function AddToCartBar({
  canAdd,
  canBuy,
  quantity,
  onAdd,
  onBuyNow,
  blockedTitle,
  blockedMessage,
  onLayout,
}: AddToCartBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + spacing.md }]} onLayout={onLayout}>
      <View style={styles.inner}>
        {!canAdd && blockedMessage ? (
          <View style={styles.blocked} accessibilityLiveRegion="polite">
            <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
            <Text style={styles.blockedText}>{blockedMessage}</Text>
          </View>
        ) : null}
        <View style={styles.buttons}>
          <Button
            title={canAdd ? 'Add to Cart' : blockedTitle}
            variant="outline"
            icon={canAdd ? 'cart-outline' : undefined}
            disabled={!canAdd}
            onPress={onAdd}
            accessibilityHint={canAdd ? `Adds ${quantity} to your cart` : undefined}
            style={[styles.button, styles.addButton]}
          />
          <Button
            title="Buy Now"
            icon="flash-outline"
            disabled={!canBuy}
            onPress={onBuyNow}
            accessibilityHint={canAdd ? `Adds ${quantity} to your cart and goes to checkout` : 'Goes to checkout'}
            style={styles.button}
          />
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
  buttons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  button: {
    flex: 1,
    paddingHorizontal: spacing.sm,
  },
  addButton: {
    borderColor: colors.navy,
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
