import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, spacing, typography } from '@/constants/theme';
import { getDemoProductArt } from '@/data/demoProductArt';
import {
  getCartQuantityFloor,
  removeFromCart,
  setCartQuantity,
  type CartItem,
} from '@/state/cartStore';
import { getCategoryIcon } from '@/utils/categoryIcon';
import { formatPrice, lineSubtotal } from '@/utils/format';

import { ProductImage } from './ProductImage';
import { QuantitySelector } from './QuantitySelector';

type CartItemCardProps = {
  item: CartItem;
};

function confirmRemove(name: string, onConfirm: () => void) {
  const title = 'Remove item';
  const message = `Remove ${name} from your cart?`;
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: onConfirm },
  ]);
}

export function CartItemCard({ item }: CartItemCardProps) {
  const router = useRouter();
  const floor = getCartQuantityFloor(item);
  const canIncrease = item.quantity + item.quantityStep <= item.maxQuantity;
  const subtotal = lineSubtotal(item.price, item.quantity);

  const openProduct = () =>
    router.push({ pathname: '/products/[id]', params: { id: item.productId } });

  return (
    <View style={styles.card}>
      <Pressable
        onPress={openProduct}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, view details`}
      >
        <ProductImage
          uri={item.imageUrl}
          localSource={getDemoProductArt(item.productId)}
          fallbackIcon={getCategoryIcon(item.categoryId)}
          accessibilityLabel={item.name}
          iconSize={28}
          style={styles.thumb}
        />
      </Pressable>

      <View style={styles.info}>
        {item.brandName ? (
          <Text style={styles.brand} numberOfLines={1}>
            {item.brandName}
          </Text>
        ) : null}
        <Text style={styles.name} numberOfLines={2} onPress={openProduct}>
          {item.name}
        </Text>
        {item.unit ? (
          <Text style={styles.unit} numberOfLines={1}>
            {item.unit}
          </Text>
        ) : null}

        <View style={styles.priceRow}>
          <Text style={styles.unitPrice}>{formatPrice(item.price)} each</Text>
          <Text style={styles.lineTotal} accessibilityLabel={`Line subtotal ${formatPrice(subtotal)}`}>
            {formatPrice(subtotal)}
          </Text>
        </View>

        <View style={styles.actions}>
          <QuantitySelector
            value={item.quantity}
            min={floor}
            max={item.maxQuantity}
            step={item.quantityStep}
            onChange={(quantity) => setCartQuantity(item.productId, quantity)}
            itemName={item.name}
          />
          <Pressable
            onPress={() => confirmRemove(item.name, () => removeFromCart(item.productId))}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${item.name} from cart`}
            hitSlop={8}
            style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
          >
            <Ionicons name="trash-outline" size={16} color={colors.error} />
            <Text style={styles.removeText}>Remove</Text>
          </Pressable>
        </View>

        {!canIncrease ? (
          <Text style={styles.limitText}>Maximum quantity reached</Text>
        ) : item.quantity <= floor ? (
          <Text style={styles.hintText}>Use Remove to take this item out of the cart.</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: radius.sm,
  },
  info: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  brand: {
    ...typography.small,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  name: {
    ...typography.label,
    color: colors.text,
  },
  unit: {
    ...typography.small,
    color: colors.textMuted,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  unitPrice: {
    ...typography.caption,
    color: colors.textMuted,
  },
  lineTotal: {
    ...typography.label,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  remove: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  removeText: {
    ...typography.small,
    fontFamily: fonts.semiBold,
    color: colors.error,
  },
  pressed: {
    backgroundColor: colors.surface,
  },
  limitText: {
    ...typography.small,
    color: colors.warning,
    marginTop: spacing.xs,
  },
  hintText: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
