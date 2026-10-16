import Ionicons from '@expo/vector-icons/Ionicons';
import { memo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { ProductImage } from '@/components/store/ProductImage';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { getDemoProductArt } from '@/data/demoProductArt';
import { getAddableRange, getMaxQuantity, useCartQuantity } from '@/state/cartStore';
import type { Product } from '@/types/catalog';
import { getCategoryIcon } from '@/utils/categoryIcon';
import { discountPercent, formatPrice } from '@/utils/format';

export const RAIL_CARD_WIDTH = 124;

type RailProductCardProps = {
  product: Product;
  onOpen: (product: Product) => void;
  onAdd: (product: Product, quantity: number) => void;
};

/** Product card with a quantity picker (− n +) and an Add button that adds that quantity. */
function RailProductCardComponent({ product, onOpen, onAdd }: RailProductCardProps) {
  const quantityInCart = useCartQuantity(product.id);
  const range = getAddableRange(product, quantityInCart);
  const isOutOfStock = getMaxQuantity(product) === 0;
  const [picked, setPicked] = useState<number | null>(null);
  const quantity = range ? Math.min(Math.max(picked ?? range.min, range.min), range.max) : 0;
  const discount = product.price !== undefined ? discountPercent(product.price, product.originalPrice) : undefined;

  const add = () => {
    if (!range) return;
    onAdd(product, quantity);
    setPicked(null);
  };

  const disabledLabel = isOutOfStock ? 'Sold out' : product.price === undefined ? 'N/A' : 'Max';

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => onOpen(product)}
        accessibilityRole="button"
        accessibilityLabel={`${product.name}, view details`}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <View>
          <ProductImage
            uri={product.imageUrl}
            localSource={getDemoProductArt(product.id)}
            fallbackIcon={getCategoryIcon(product.categoryId)}
            accessibilityLabel={product.name}
            style={styles.image}
          />
          {discount ? (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{discount}% OFF</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {product.name}
          </Text>
          <Text style={styles.unit} numberOfLines={1}>
            {product.unit ?? ' '}
          </Text>
          {product.price !== undefined ? (
            <View style={styles.priceRow}>
              <Text style={styles.price}>{formatPrice(product.price)}</Text>
              {discount && product.originalPrice ? (
                <Text
                  style={styles.original}
                  accessibilityLabel={`Original price ${formatPrice(product.originalPrice)}`}
                >
                  {formatPrice(product.originalPrice)}
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={styles.priceMissing}>Price unavailable</Text>
          )}
        </View>
      </Pressable>

      <View style={styles.actions}>
        <View style={[styles.stepper, !range && styles.stepperDisabled]}>
          <Pressable
            onPress={() => range && setPicked(quantity - range.step)}
            disabled={!range || quantity <= range.min}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Decrease quantity of ${product.name}`}
            style={styles.stepButton}
          >
            <Ionicons name="remove" size={14} color={range && quantity > range.min ? colors.text : colors.disabled} />
          </Pressable>
          <Text style={styles.quantity} accessibilityLabel={`Quantity ${quantity}`}>
            {range ? quantity : '-'}
          </Text>
          <Pressable
            onPress={() => range && setPicked(quantity + range.step)}
            disabled={!range || quantity + range.step > range.max}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Increase quantity of ${product.name}`}
            style={styles.stepButton}
          >
            <Ionicons
              name="add"
              size={14}
              color={range && quantity + range.step <= range.max ? colors.text : colors.disabled}
            />
          </Pressable>
        </View>

        <Pressable
          onPress={add}
          disabled={!range}
          accessibilityRole="button"
          accessibilityLabel={range ? `Add ${quantity} ${product.name} to cart` : disabledLabel}
          accessibilityState={{ disabled: !range }}
          style={({ pressed }) => [styles.addButton, pressed && styles.addPressed, !range && styles.addDisabled]}
        >
          <Text style={[styles.addText, !range && styles.addDisabledText]} numberOfLines={1}>
            {range ? 'Add' : disabledLabel}
          </Text>
        </Pressable>
      </View>
      {quantityInCart > 0 ? <Text style={styles.inCart}>{quantityInCart} in cart</Text> : null}
    </View>
  );
}

export const RailProductCard = memo(RailProductCardComponent);

export function RailProductCardSkeleton() {
  return (
    <View style={styles.card} accessibilityElementsHidden importantForAccessibility="no">
      <View style={[styles.image, styles.skeleton]} />
      <View style={[styles.skeletonLine, { width: '90%' }]} />
      <View style={[styles.skeletonLine, { width: '50%' }]} />
      <View style={[styles.actions, styles.skeletonActions]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: RAIL_CARD_WIDTH,
    gap: spacing.sm,
    padding: 6,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    ...Platform.select({
      web: { boxShadow: '0px 2px 8px rgba(11, 42, 91, 0.10)' },
      default: {
        shadowColor: colors.navy,
        shadowOpacity: 0.1,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      },
    }),
  },
  pressed: {
    opacity: 0.85,
  },
  image: {
    width: '100%',
    aspectRatio: 1.1,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  discountBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: colors.orange,
  },
  discountText: {
    fontSize: 9,
    lineHeight: 13,
    fontFamily: fonts.bold,
    color: colors.white,
  },
  info: {
    marginTop: 6,
    paddingHorizontal: 2,
  },
  name: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: fonts.semiBold,
    color: colors.text,
  },
  unit: {
    fontSize: 9,
    lineHeight: 13,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    columnGap: 4,
    marginTop: 4,
  },
  price: {
    fontSize: 14,
    lineHeight: 19,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  original: {
    fontSize: 10,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  priceMissing: {
    marginTop: 4,
    fontSize: 10,
    lineHeight: 19,
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 28,
  },
  stepper: {
    flex: 1,
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  stepperDisabled: {
    opacity: 0.5,
  },
  stepButton: {
    width: 20,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantity: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: fonts.semiBold,
    color: colors.text,
  },
  addButton: {
    minWidth: 44,
    height: 28,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: colors.orange,
  },
  addPressed: {
    backgroundColor: colors.orangePressed,
  },
  addDisabled: {
    backgroundColor: colors.surface,
  },
  addText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.semiBold,
    color: colors.white,
  },
  addDisabledText: {
    fontSize: 10,
    color: colors.textMuted,
  },
  inCart: {
    marginTop: -4,
    fontSize: 9,
    lineHeight: 12,
    fontFamily: fonts.semiBold,
    color: colors.navy,
    textAlign: 'center',
  },
  skeleton: {
    backgroundColor: '#EDF1F5',
  },
  skeletonLine: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EDF1F5',
  },
  skeletonActions: {
    borderRadius: 6,
    backgroundColor: '#EDF1F5',
  },
});
