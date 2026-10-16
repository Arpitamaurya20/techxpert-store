import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, spacing } from '@/constants/theme';
import { discountPercent, formatPrice } from '@/utils/format';

type PriceTagProps = {
  price?: number;
  originalPrice?: number;
  size?: 'regular' | 'large';
};

/** Strike-through price and discount appear only when the backend sends a verified original price. */
export function PriceTag({ price, originalPrice, size = 'regular' }: PriceTagProps) {
  const isLarge = size === 'large';

  if (price === undefined) {
    return (
      <Text style={[styles.unavailable, isLarge && styles.unavailableLarge]}>Price unavailable</Text>
    );
  }

  const discount = discountPercent(price, originalPrice);

  return (
    <View style={styles.row}>
      <Text style={[styles.price, isLarge && styles.priceLarge]}>{formatPrice(price)}</Text>
      {discount && originalPrice ? (
        <>
          <Text
            style={[styles.original, isLarge && styles.originalLarge]}
            accessibilityLabel={`Original price ${formatPrice(originalPrice)}`}
          >
            {formatPrice(originalPrice)}
          </Text>
          <Text style={[styles.discount, isLarge && styles.discountLarge]}>{discount}% off</Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    columnGap: spacing.xs,
  },
  price: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  priceLarge: {
    fontSize: 24,
    lineHeight: 32,
  },
  original: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  originalLarge: {
    fontSize: 14,
  },
  discount: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.accent,
  },
  discountLarge: {
    fontSize: 14,
  },
  unavailable: {
    fontSize: 13,
    lineHeight: 22,
    fontFamily: fonts.semiBold,
    color: colors.textMuted,
  },
  unavailableLarge: {
    fontSize: 18,
    lineHeight: 32,
  },
});
