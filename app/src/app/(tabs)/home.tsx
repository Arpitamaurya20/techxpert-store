import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { CategoryShortcuts } from '@/components/home/CategoryShortcuts';
import { FeaturedProductsRail } from '@/components/home/FeaturedProductsRail';
import { HeroCarousel } from '@/components/home/HeroCarousel';
import { OrderAgainSection, type OrderAgainMode } from '@/components/home/OrderAgainSection';
import { ProjectDeals } from '@/components/home/ProjectDeals';
import { QuickTools } from '@/components/home/QuickTools';
import { SearchSuggestions } from '@/components/home/SearchSuggestions';
import { ShopByProject } from '@/components/home/ShopByProject';
import { TrustStrip } from '@/components/home/TrustStrip';
import { DemoDataNotice } from '@/components/store/DemoDataNotice';
import { StoreHeader } from '@/components/store/StoreHeader';
import { StateView } from '@/components/ui/StateView';
import { MAX_STORE_WIDTH, SCREEN_PADDING, colors, spacing } from '@/constants/theme';
import { SAMPLE_ORDER_AGAIN_IDS } from '@/data/homeContent';
import { useAddToCart } from '@/hooks/useAddToCart';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useStatusBarStyle } from '@/hooks/useStatusBarStyle';
import { useStoreLayout } from '@/hooks/useStoreLayout';
import { getErrorMessage } from '@/services/apiClient';
import { getOrders } from '@/services/orderApi';
import { getCategories, getFeaturedProducts, getProductById } from '@/services/productApi';
import { clearRecentlyViewed, useRecentlyViewedIds } from '@/state/recentlyViewedStore';
import { useSession } from '@/state/sessionStore';
import type { Category, Product } from '@/types/catalog';

const FEATURED_LIMIT = 10;
const ORDER_AGAIN_LIMIT = 10;

/** Today's catalogue entries for the given ids; items no longer sold are dropped. */
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

async function loadOrderAgain(): Promise<{ mode: OrderAgainMode; products: Product[] }> {
  const result = await getOrders();
  if (result.state === 'not_connected') {
    return { mode: 'sample', products: await loadProducts(SAMPLE_ORDER_AGAIN_IDS) };
  }
  if (result.state === 'signed_out') return { mode: 'signed_out', products: [] };

  const ids = [...new Set(result.orders.flatMap((order) => order.items.map((item) => item.productId)))];
  return { mode: 'orders', products: await loadProducts(ids.slice(0, ORDER_AGAIN_LIMIT)) };
}

export default function HomeScreen() {
  useStatusBarStyle('dark');
  const router = useRouter();
  const layout = useStoreLayout();
  const session = useSession();
  const handleAddToCart = useAddToCart();
  const [refreshKey, setRefreshKey] = useState(0);

  const categories = useAsyncData('home-categories', getCategories);
  const orderAgain = useAsyncData(`home-order-again-${session?.user.id ?? 'guest'}-${refreshKey}`, loadOrderAgain, {
    keepPreviousData: true,
  });
  const featured = useAsyncData(`home-featured-${refreshKey}`, () => getFeaturedProducts(FEATURED_LIMIT), {
    keepPreviousData: true,
  });
  const recentIds = useRecentlyViewedIds();
  const recent = useAsyncData(`home-recent-${recentIds.join(',')}`, () => loadProducts(recentIds), {
    keepPreviousData: true,
  });
  const recentProducts = (recent.data ?? []).filter((product) => recentIds.includes(product.id));

  const categoryList = categories.data?.data ?? [];
  const isDemo = categories.data?.source === 'demo' || featured.data?.source === 'demo';
  const isRefreshing = categories.isRefreshing || orderAgain.isUpdating || featured.isUpdating;

  const refreshAll = () => {
    categories.refresh();
    setRefreshKey((key) => key + 1);
  };

  const openCategory = useCallback(
    (category: Category) => router.push({ pathname: '/category/[id]', params: { id: category.id } }),
    [router]
  );

  const openProduct = useCallback(
    (product: Product) => router.push({ pathname: '/products/[id]', params: { id: product.id } }),
    [router]
  );

  const addProduct = useCallback(
    (product: Product, quantity: number) => handleAddToCart(product, quantity),
    [handleAddToCart]
  );

  const openAllCategories = () => router.navigate('/categories');

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      stickyHeaderIndices={[0]}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={refreshAll}
          colors={[colors.orange]}
          tintColor={colors.navy}
          progressBackgroundColor={colors.card}
        />
      }
    >
      <StoreHeader />

      <View style={styles.body}>
        <SearchSuggestions />

        {categories.status === 'error' ? (
          <StateView
            variant="error"
            compact
            title="Couldn't load categories"
            message={getErrorMessage(categories.error)}
            actionLabel="Try Again"
            onAction={categories.reload}
          />
        ) : (
          <CategoryShortcuts
            categories={categoryList}
            loading={categories.status === 'loading'}
            onOpenCategory={openCategory}
            onViewAll={openAllCategories}
          />
        )}

        <HeroCarousel width={layout.contentWidth} />

        <TrustStrip />

        <QuickTools />

        <OrderAgainSection
          status={orderAgain.status}
          mode={orderAgain.data?.mode}
          products={orderAgain.data?.products ?? []}
          onRetry={orderAgain.reload}
          onOpenProduct={openProduct}
          onAdd={addProduct}
        />

        <ShopByProject />

        <ProjectDeals
          categories={categoryList}
          showSampleOffers={isDemo}
          onOpenCategory={openCategory}
          onViewAll={openAllCategories}
        />

        {recentIds.length > 0 ? (
          <FeaturedProductsRail
            title="Recently Viewed"
            status={recent.status === 'loading' && recentProducts.length === 0 ? 'loading' : 'success'}
            products={recentProducts}
            onRetry={recent.reload}
            actionLabel="Clear"
            onSeeAll={clearRecentlyViewed}
            onOpenProduct={openProduct}
            onAdd={addProduct}
          />
        ) : null}

        <FeaturedProductsRail
          title="Featured Products"
          status={featured.status}
          products={featured.data?.data ?? []}
          error={featured.error}
          onRetry={featured.reload}
          onSeeAll={() => router.push({ pathname: '/products', params: { featured: 'true' } })}
          onOpenProduct={openProduct}
          onAdd={addProduct}
        />

        {isDemo ? (
          <DemoDataNotice message="Sample data: products, prices, offers and Order Again items shown here are placeholders until the Techxpert store is connected." />
        ) : null}
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
    paddingBottom: spacing.xxl,
  },
  body: {
    width: '100%',
    maxWidth: MAX_STORE_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
});
