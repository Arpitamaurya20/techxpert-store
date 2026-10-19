import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, spacing, typography } from '@/constants/theme';
import { getDemoProductArt } from '@/data/demoProductArt';
import { getAddableRange, getMaxQuantity, useCartQuantity } from '@/state/cartStore';
import type { Product } from '@/types/catalog';
import { getCategoryIcon } from '@/utils/categoryIcon';
import { discountPercent, formatPrice } from '@/utils/format';

import { ProductImage } from './ProductImage';
import { WishlistButton } from './WishlistButton';

type ProductCardProps = {
  product: Product;
  width: number;
  onOpen: (product: Product) => void;
  onAddToCart: (product: Product) => void;
};

function ProductCardComponent({ product, width, onOpen, onAddToCart }: ProductCardProps) {
  const quantityInCart = useCartQuantity(product.id);
  const isOutOfStock = getMaxQuantity(product) === 0;
  const canAdd = getAddableRange(product, quantityInCart) !== null;
  const discount =
    product.price !== undefined ? discountPercent(product.price, product.originalPrice) : undefined;

  const buttonLabel = isOutOfStock
    ? 'SOLD OUT'
    : product.price === undefined
      ? 'N/A'
      : canAdd
        ? 'ADD'
        : 'MAX';
  const buttonA11yLabel = canAdd
    ? `Add ${product.name} to cart`
    : isOutOfStock
      ? 'Out of Stock'
      : product.price === undefined
        ? 'Price Unavailable'
        : 'Max in Cart';

  return (
    <View style={[styles.card, { width }]}>
      <View>
        <Pressable
          onPress={() => onOpen(product)}
          accessibilityRole="button"
          accessibilityLabel={`${product.name}, view details`}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ProductImage
            uri={product.imageUrl}
            localSource={getDemoProductArt(product.id)}
            fallbackIcon={getCategoryIcon(product.categoryId)}
            accessibilityLabel={product.name}
            style={styles.image}
          />
        </Pressable>
        <View style={styles.wishlist}>
          <WishlistButton productId={product.id} productName={product.name} />
        </View>

        <Pressable
          onPress={() => onAddToCart(product)}
          disabled={!canAdd}
          accessibilityRole="button"
          accessibilityLabel={buttonA11yLabel}
          accessibilityState={{ disabled: !canAdd }}
          style={({ pressed }) => [
            styles.addButton,
            pressed && styles.addButtonPressed,
            !canAdd && styles.addButtonDisabled,
          ]}
        >
          <Text style={[styles.addLabel, !canAdd && styles.addLabelDisabled]}>{buttonLabel}</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => onOpen(product)}
        accessible={false}
        style={({ pressed }) => [styles.info, pressed && styles.pressed]}
      >
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
          <Text style={styles.unavailable}>Price unavailable</Text>
        )}
        {discount ? <Text style={styles.discount}>{discount}% OFF</Text> : null}

        <Text style={styles.name} numberOfLines={3}>
          {product.name}
        </Text>
        {product.unit ? (
          <Text style={styles.unit} numberOfLines={1}>
            {product.unit}
          </Text>
        ) : null}

        {product.stockStatus === 'low_stock' ? (
          <Text style={[styles.status, styles.statusLow]}>
            {product.stockQuantity ? `Only ${product.stockQuantity} left` : 'Low stock'}
          </Text>
        ) : product.stockStatus === 'out_of_stock' ? (
          <Text style={[styles.status, styles.statusOut]}>Out of stock</Text>
        ) : null}
        {quantityInCart > 0 ? <Text style={styles.inCart}>{quantityInCart} in cart</Text> : null}
      </Pressable>
    </View>
  );
}

export const ProductCard = memo(ProductCardComponent);

/** Same footprint as a card, so the grid does not jump when products arrive. */
export function ProductCardSkeleton({ width }: { width: number }) {
  return (
    <View style={[styles.card, { width }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={[styles.image, styles.skeletonBlock]} />
      <View style={styles.info}>
        <View style={[styles.skeletonLine, { width: '45%', height: 18 }]} />
        <View style={[styles.skeletonLine, { width: '90%' }]} />
        <View style={[styles.skeletonLine, { width: '65%' }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.85,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: '#F5F6F8',
  },
  wishlist: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },
  addButton: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    minWidth: 72,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  addButtonPressed: {
    borderColor: colors.accentPressed,
    backgroundColor: colors.accentPressed,
  },
  addButtonDisabled: {
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
  },
  addLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.bold,
    letterSpacing: 0.5,
    color: colors.white,
  },
  addLabelDisabled: {
    fontSize: 11,
    color: colors.textMuted,
  },
  info: {
    gap: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    columnGap: spacing.xs,
  },
  price: {
    fontSize: 20,
    lineHeight: 28,
    fontFamily: fonts.bold,
    color: colors.homeInk,
  },
  original: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  unavailable: {
    fontSize: 14,
    lineHeight: 28,
    fontFamily: fonts.semiBold,
    color: colors.textMuted,
  },
  discount: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.bold,
    color: colors.accent,
  },
  name: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.homeInk,
    marginTop: 2,
  },
  unit: {
    ...typography.small,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  status: {
    ...typography.small,
    fontFamily: fonts.semiBold,
  },
  statusLow: {
    color: colors.warning,
  },
  statusOut: {
    color: colors.error,
  },
  inCart: {
    ...typography.small,
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },
  skeletonBlock: {
    backgroundColor: '#EDF1F5',
  },
  skeletonLine: {
    height: 12,
    marginVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EDF1F5',
  },
});
