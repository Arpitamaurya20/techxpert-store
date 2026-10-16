import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BrandGrid } from '@/components/store/BrandGrid';
import { CategoryCard } from '@/components/store/CategoryCard';
import { DemoDataNotice } from '@/components/store/DemoDataNotice';
import { DiwaliOfferBanner } from '@/components/store/DiwaliOfferBanner';
import { HomeProductSection } from '@/components/store/HomeProductSection';
import { ProductSearchBar } from '@/components/store/ProductSearchBar';
import { StoreBanner } from '@/components/store/StoreBanner';
import { StoreHeader } from '@/components/store/StoreHeader';
import { StoreLogoBar } from '@/components/store/StoreLogoBar';
import { StateView } from '@/components/ui/StateView';
import { MAX_STORE_WIDTH, SCREEN_PADDING, colors, fonts, spacing } from '@/constants/theme';
import { HOME_PRODUCT_SECTIONS } from '@/data/homeSections';
import { useAddToCart } from '@/hooks/useAddToCart';
import { useAsyncData } from '@/hooks/useAsyncData';
import { usePinnedSearch } from '@/hooks/usePinnedSearch';
import { useStatusBarStyle } from '@/hooks/useStatusBarStyle';
import { GRID_GAP, useStoreLayout } from '@/hooks/useStoreLayout';
import { getErrorMessage } from '@/services/apiClient';
import { getBrands, getCategories } from '@/services/productApi';
import type { Brand, Category, Product } from '@/types/catalog';

export default function HomeScreen() {
  useStatusBarStyle('dark');
  const router = useRouter();
  const layout = useStoreLayout();
  const handleAddToCart = useAddToCart();
  const [searchText, setSearchText] = useState('');
  const pinnedSearch = usePinnedSearch();

  const [refreshKey, setRefreshKey] = useState(0);

  const categories = useAsyncData('home-categories', getCategories);
  const brands = useAsyncData('home-brands', getBrands);

  const isDemo = categories.data?.source === 'demo';
  const isRefreshing = categories.isRefreshing || brands.isRefreshing;

  const refreshAll = () => {
    categories.refresh();
    brands.refresh();
    setRefreshKey((key) => key + 1);
  };

  const openProduct = useCallback(
    (product: Product) => router.push({ pathname: '/products/[id]', params: { id: product.id } }),
    [router]
  );

  const openCategory = useCallback(
    (category: Category) => router.push({ pathname: '/category/[id]', params: { id: category.id } }),
    [router]
  );

  const openBrand = useCallback(
    (brand: Brand) =>
      router.push({ pathname: '/products', params: { brandId: brand.id, brandName: brand.name } }),
    [router]
  );

  const homeCategories = categories.data?.data ?? [];
  const brandList = brands.data?.data ?? [];

  const searchBar = (
    <ProductSearchBar
      value={searchText}
      onChangeText={setSearchText}
      onSubmit={(search) => router.push({ pathname: '/products', params: { search } })}
      placeholder="What do you need today?"
      shape="pill"
    />
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      stickyHeaderIndices={[0]}
      onScroll={pinnedSearch.onScroll}
      scrollEventThrottle={16}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={refreshAll}
          colors={[colors.accent]}
          tintColor={colors.homeInk}
          progressBackgroundColor={colors.card}
        />
      }
    >
      <StoreLogoBar search={searchBar} showSearch={pinnedSearch.isSearchPinned} />
      <StoreHeader onSearchLayout={pinnedSearch.onSearchLayout}>{searchBar}</StoreHeader>

      <StoreBanner
        categories={homeCategories}
        onExplore={() => router.push('/products')}
        onOpenCategory={openCategory}
      />

      <View style={styles.body}>
        <View>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Shop by Categories
          </Text>
          {categories.status === 'loading' ? (
            <StateView variant="loading" compact message="Loading categories…" />
          ) : categories.status === 'error' ? (
            <StateView
              variant="error"
              compact
              title="Couldn't load categories"
              message={getErrorMessage(categories.error)}
              actionLabel="Try Again"
              onAction={categories.reload}
            />
          ) : homeCategories.length === 0 ? (
            <StateView variant="empty" compact icon="grid-outline" title="No categories available yet" />
          ) : (
            <View style={styles.tileGrid}>
              {homeCategories.map((category) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  width={layout.categoryTileWidth}
                  onPress={openCategory}
                />
              ))}
            </View>
          )}
        </View>

        {isDemo ? <DemoDataNotice /> : null}

        <DiwaliOfferBanner onShop={() => router.push('/products')} />

        {brands.status === 'success' && brandList.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              Brands
            </Text>
            <BrandGrid brands={brandList} tileWidth={layout.categoryTileWidth} onPress={openBrand} />
          </View>
        ) : null}

        {HOME_PRODUCT_SECTIONS.map((section) => (
          <HomeProductSection
            key={section.id}
            section={section}
            cardWidth={layout.productCardWidth}
            refreshKey={refreshKey}
            onOpenProduct={openProduct}
            onAddToCart={handleAddToCart}
          />
        ))}
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
    paddingTop: spacing.xl,
    gap: spacing.xl,
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: fonts.bold,
    color: colors.homeInk,
    marginBottom: spacing.md,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: GRID_GAP,
    rowGap: spacing.md,
  },
});
