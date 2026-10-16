import { StyleSheet, Text } from 'react-native';

import { colors, fonts, typography } from '@/constants/theme';
import type { Product } from '@/types/catalog';

type StockBadgeProps = {
  product: Pick<Product, 'stockStatus' | 'stockQuantity'>;
};

/** Renders nothing when the backend does not report stock. */
export function StockBadge({ product }: StockBadgeProps) {
  const { stockStatus, stockQuantity } = product;
  if (!stockStatus) return null;

  if (stockStatus === 'out_of_stock') {
    return <Text style={[styles.text, styles.out]}>Out of stock</Text>;
  }
  if (stockStatus === 'low_stock') {
    return (
      <Text style={[styles.text, styles.low]}>
        {stockQuantity ? `Only ${stockQuantity} left` : 'Low stock'}
      </Text>
    );
  }
  return <Text style={[styles.text, styles.in]}>In stock</Text>;
}

const styles = StyleSheet.create({
  text: {
    ...typography.small,
    fontFamily: fonts.semiBold,
  },
  in: {
    color: colors.accent,
  },
  low: {
    color: colors.warning,
  },
  out: {
    color: colors.error,
  },
});
