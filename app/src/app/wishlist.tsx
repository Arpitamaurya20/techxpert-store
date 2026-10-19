import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ProductCard, ProductCardSkeleton } from '@/components/store/ProductCard';
import { HeaderBackFallback } from '@/components/ui/HeaderBackFallback';
import { StateView } from '@/components/ui/StateView';
import { MAX_STORE_WIDTH, SCREEN_PADDING, colors, fonts, spacing } from '@/constants/theme';
import { useAddToCart } from '@/hooks/useAddToCart';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useStatusBarStyle } from '@/hooks/useStatusBarStyle';
import { GRID_GAP, useStoreLayout } from '@/hooks/useStoreLayout';
import { getProductById } from '@/services/productApi';
import { useWishlistIds } from '@/state/wishlistStore';
import type { Product } from '@/types/catalog';

async function loadProducts(ids: string[]): Promise<Product[]> {
  const results = await Promise.all(
    ids.map((id) =>
      getProductById(id)
        .then((result) => result.data)
        .catch(() => null)
    )
  );
  return results.filter((product): product is Product => product !== null);
}

export default function WishlistScreen() {
  useStatusBarStyle('dark');
  const router = useRouter();
  const layout = useStoreLayout();
  const handleAddToCart = useAddToCart();
  const ids = useWishlistIds();
  const products = useAsyncData(`wishlist-${ids.join(',')}`, () => loadProducts(ids), { keepPreviousData: true });

  const openProduct = useCallback(
    (product: Product) => router.push({ pathname: '/products/[id]', params: { id: product.id } }),
    [router]
  );

  const list = (products.data ?? []).filter((product) => ids.includes(product.id));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <HeaderBackFallback fallback="/home" accessibilityLabel="Back to Home" />
      <View style={styles.inner}>
        {ids.length === 0 ? (
          <StateView
            variant="empty"
            icon="heart-outline"
            title="No saved items yet"
            message="Tap the heart on any product to save it here for later."
            actionLabel="Browse Categories"
            onAction={() => router.navigate('/categories')}
          />
        ) : products.status === 'loading' && list.length === 0 ? (
          <View style={styles.grid}>
            {ids.slice(0, 4).map((id) => (
              <ProductCardSkeleton key={id} width={layout.productCardWidth} />
            ))}
          </View>
        ) : (
          <>
            <Text style={styles.count}>
              {list.length} saved {list.length === 1 ? 'product' : 'products'} · stored on this device
            </Text>
            <View style={styles.grid}>
              {list.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  width={layout.productCardWidth}
                  onOpen={openProduct}
                  onAddToCart={handleAddToCart}
                />
              ))}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: SCREEN_PADDING,
    paddingBottom: spacing.xxl,
  },
  inner: {
    width: '100%',
    maxWidth: MAX_STORE_WIDTH,
    alignSelf: 'center',
    gap: spacing.md,
  },
  count: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
});
