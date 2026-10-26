import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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
import { isApiConfigured } from '@/services/apiConfig';
import { getDeals, getHelpContent, getHomeContent, getHomepageSections, getSearchIdeas, getTrustClaims } from '@/services/cmsApi';
import { getOrders } from '@/services/orderApi';
import { getCategories, getFeaturedProducts, getProductById } from '@/services/productApi';
import { clearRecentlyViewed, useRecentlyViewedIds } from '@/state/recentlyViewedStore';
import { useSession } from '@/state/sessionStore';
import type { Category, Product } from '@/types/catalog';

const FEATURED_LIMIT = 10;
const ORDER_AGAIN_LIMIT = 10;

const DEFAULT_HOME_SECTIONS = [
  { type: 'category_shortcuts', title: 'Category shortcuts' },
  { type: 'hero_carousel', title: 'Campaign hero' },
  { type: 'trust_strip', title: 'Trust strip' },
  { type: 'category_grid', title: 'Shop by project' },
  { type: 'order_again_rail', title: 'Order again' },
  { type: 'offer_tiles', title: 'Deals for your projects' },
  { type: 'product_rail', title: 'Popular products' },
  { type: 'bulk_enquiry', title: 'Quick tools' },
] as const;

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
  const cmsSections = useAsyncData(`home-sections-${refreshKey}`, getHomepageSections, {
    keepPreviousData: true,
  });
  const homeLists = useAsyncData(`home-lists-${refreshKey}`, getHomeContent, { keepPreviousData: true });
  const searchIdeas = useAsyncData(`home-ideas-${refreshKey}`, getSearchIdeas, { keepPreviousData: true });
  const trust = useAsyncData(`home-trust-${refreshKey}`, getTrustClaims, { keepPreviousData: true });
  const deals = useAsyncData(`home-deals-${refreshKey}`, getDeals, { keepPreviousData: true });
  const help = useAsyncData(`home-help-${refreshKey}`, getHelpContent, { keepPreviousData: true });
  const recentIds = useRecentlyViewedIds();
  const recent = useAsyncData(`home-recent-${recentIds.join(',')}`, () => loadProducts(recentIds), {
    keepPreviousData: true,
  });
  const recentProducts = (recent.data ?? []).filter((product) => recentIds.includes(product.id));

  const categoryList = categories.data?.data ?? [];
  const isDemo = categories.data?.source === 'demo' || featured.data?.source === 'demo';
  const isRefreshing =
    categories.isRefreshing ||
    orderAgain.isUpdating ||
    featured.isUpdating ||
    cmsSections.isUpdating ||
    homeLists.isUpdating ||
    searchIdeas.isUpdating ||
    trust.isUpdating ||
    deals.isUpdating ||
    help.isUpdating;

  const orderedSections = useMemo(() => {
    const live = cmsSections.data?.sections ?? [];
    if (live.length === 0) return DEFAULT_HOME_SECTIONS.map((section) => ({ ...section }));
    return live.map((section) => ({ type: section.type, title: section.title || section.type }));
  }, [cmsSections.data?.sections]);

  const refreshAll = () => {
    categories.refresh();
    cmsSections.refresh();
    homeLists.refresh();
    searchIdeas.refresh();
    trust.refresh();
    deals.refresh();
    help.refresh();
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

  const waiting = (status: string, hasData: boolean) => isApiConfigured && status === 'loading' && !hasData;
  const liveShortcuts = homeLists.data?.source === 'live' ? homeLists.data.data.shortcuts : undefined;
  const liveProjects = homeLists.data?.source === 'live' ? homeLists.data.data.projects : undefined;
  const liveIdeas = searchIdeas.data?.source === 'live' ? searchIdeas.data.data : undefined;
  const liveClaims = trust.data?.source === 'live' ? trust.data.data : undefined;
  const liveDeals = deals.data?.source === 'live' ? deals.data.data : undefined;
  const helpPhone = help.data?.source === 'live' ? help.data.data : undefined;

  const renderSection = (code: string, title: string, key: string) => {
    switch (code) {
      case 'hero_banners':
      case 'hero_carousel':
        return <HeroCarousel key={key} width={layout.contentWidth} refreshKey={refreshKey} />;
      case 'category_shortcuts':
        if (homeLists.status === 'error') {
          return (
            <StateView
              key={key}
              variant="error"
              compact
              title="Couldn't load shortcuts"
              message={getErrorMessage(homeLists.error)}
              actionLabel="Try Again"
              onAction={homeLists.reload}
            />
          );
        }
        return categories.status === 'error' ? (
          <StateView
            key={key}
            variant="error"
            compact
            title="Couldn't load categories"
            message={getErrorMessage(categories.error)}
            actionLabel="Try Again"
            onAction={categories.reload}
          />
        ) : (
          <CategoryShortcuts
            key={key}
            categories={categoryList}
            loading={categories.status === 'loading' || waiting(homeLists.status, Boolean(homeLists.data))}
            published={liveShortcuts}
            onOpenCategory={openCategory}
            onViewAll={openAllCategories}
          />
        );
      case 'trust_strip':
        if (trust.status === 'error') {
          return (
            <StateView
              key={key}
              variant="error"
              compact
              title="Couldn't load the trust strip"
              message={getErrorMessage(trust.error)}
              actionLabel="Try Again"
              onAction={trust.reload}
            />
          );
        }
        if (waiting(trust.status, Boolean(trust.data))) return null;
        return (
          <TrustStrip
            key={key}
            published={liveClaims}
            phone={helpPhone?.phone}
            phoneLabel={helpPhone?.phoneLabel || helpPhone?.phone}
          />
        );
      case 'bulk_enquiry':
        return <QuickTools key={key} />;
      case 'offer_tiles':
        if (deals.status === 'error') {
          return (
            <StateView
              key={key}
              variant="error"
              compact
              title="Couldn't load deals"
              message={getErrorMessage(deals.error)}
              actionLabel="Try Again"
              onAction={deals.reload}
            />
          );
        }
        if (waiting(deals.status, Boolean(deals.data))) return null;
        return (
          <ProjectDeals
            key={key}
            categories={categoryList}
            showSampleOffers={isDemo && !liveDeals}
            published={liveDeals}
            onOpenCategory={openCategory}
            onViewAll={openAllCategories}
          />
        );
      case 'order_again':
      case 'order_again_rail':
        return (
          <OrderAgainSection
            key={key}
            status={orderAgain.status}
            mode={orderAgain.data?.mode}
            products={orderAgain.data?.products ?? []}
            onRetry={orderAgain.reload}
            onOpenProduct={openProduct}
            onAdd={addProduct}
          />
        );
      case 'category_grid':
        if (homeLists.status === 'error') {
          return (
            <StateView
              key={key}
              variant="error"
              compact
              title="Couldn't load projects"
              message={getErrorMessage(homeLists.error)}
              actionLabel="Try Again"
              onAction={homeLists.reload}
            />
          );
        }
        if (waiting(homeLists.status, Boolean(homeLists.data))) return null;
        return <ShopByProject key={key} published={liveProjects} />;
      case 'featured_products':
      case 'product_rail':
        return (
          <FeaturedProductsRail
            key={key}
            title={title || 'Popular products'}
            status={featured.status}
            products={featured.data?.data ?? []}
            error={featured.error}
            onRetry={featured.reload}
            onSeeAll={() => router.push({ pathname: '/products', params: { featured: 'true' } })}
            onOpenProduct={openProduct}
            onAdd={addProduct}
          />
        );
      default:
        return null;
    }
  };

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
        {searchIdeas.status === 'error' ? (
          <StateView
            variant="error"
            compact
            title="Couldn't load search ideas"
            message={getErrorMessage(searchIdeas.error)}
            actionLabel="Try Again"
            onAction={searchIdeas.reload}
          />
        ) : waiting(searchIdeas.status, Boolean(searchIdeas.data)) ? null : (
          <SearchSuggestions published={liveIdeas} />
        )}

        {orderedSections.map((section, i) => renderSection(section.type, section.title, `${section.type}-${i}`))}

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
