import { ScrollView, StyleSheet, View } from 'react-native';

import { StateView } from '@/components/ui/StateView';
import { SCREEN_PADDING, spacing } from '@/constants/theme';
import { getErrorMessage } from '@/services/apiClient';
import type { Product } from '@/types/catalog';

import { RailProductCard, RailProductCardSkeleton } from './RailProductCard';
import { SectionHeader } from './SectionHeader';

type FeaturedProductsRailProps = {
  title: string;
  status: 'loading' | 'success' | 'error';
  products: Product[];
  error?: unknown;
  onRetry: () => void;
  onSeeAll: () => void;
  onOpenProduct: (product: Product) => void;
  onAdd: (product: Product, quantity: number) => void;
};

export function FeaturedProductsRail({
  title,
  status,
  products,
  error,
  onRetry,
  onSeeAll,
  onOpenProduct,
  onAdd,
}: FeaturedProductsRailProps) {
  if (status === 'success' && products.length === 0) return null;

  return (
    <View style={styles.section}>
      <SectionHeader title={title} actionLabel="See all" onAction={onSeeAll} />
      {status === 'error' ? (
        <StateView
          variant="error"
          compact
          title="Couldn't load products"
          message={getErrorMessage(error)}
          actionLabel="Try Again"
          onAction={onRetry}
        />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.scroller}
          contentContainerStyle={styles.row}
        >
          {status === 'loading'
            ? [0, 1, 2].map((index) => <RailProductCardSkeleton key={index} />)
            : products.map((product) => (
                <RailProductCard key={product.id} product={product} onOpen={onOpenProduct} onAdd={onAdd} />
              ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  scroller: {
    marginHorizontal: -SCREEN_PADDING,
    flexGrow: 0,
  },
  row: {
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 4,
    gap: spacing.sm,
  },
});
