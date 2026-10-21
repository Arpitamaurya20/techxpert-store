import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { FlatList, RefreshControl, StyleSheet, View, useWindowDimensions } from 'react-native';

import { CATEGORY_RAIL_WIDTH, CategoryRail, type CategoryRailItem } from '@/components/store/CategoryRail';
import { DemoDataNotice } from '@/components/store/DemoDataNotice';
import { HeaderCartButton } from '@/components/store/HeaderCartButton';
import { HeaderBackFallback } from '@/components/ui/HeaderBackFallback';
import { ProductCard, ProductCardSkeleton } from '@/components/store/ProductCard';
import { IconButton } from '@/components/ui/IconButton';
import { StateView } from '@/components/ui/StateView';
import { MAX_STORE_WIDTH, colors, spacing } from '@/constants/theme';
import { getHomeCategoryArt } from '@/data/homeCategoryArt';
import { getSubcategoryArt } from '@/data/subcategoryArt';
import { useAddToCart } from '@/hooks/useAddToCart';
import { useAsyncData } from '@/hooks/useAsyncData';
import { GRID_GAP } from '@/hooks/useStoreLayout';
import { getErrorMessage } from '@/services/apiClient';
import { getCategories, getProducts, getSubcategories } from '@/services/productApi';
import type { Product } from '@/types/catalog';
import { getCategoryIcon } from '@/utils/categoryIcon';
import { matchesSubcategory } from '@/utils/subcategoryMatch';

const ALL_ID = 'all';
const GRID_PADDING = spacing.md;
const SKELETON_CARDS = 4;
const NO_PRODUCTS: Product[] = [];

type CategoryParams = {
  id: string;
  /** Selected product type; missing means "All". */
  sub?: string;
};

export default function CategoryScreen() {
  const router = useRouter();
  const { id, sub } = useLocalSearchParams<CategoryParams>();
  const { width: screenWidth } = useWindowDimensions();
  const handleAddToCart = useAddToCart();
  const selectedId = sub || ALL_ID;

  const categories = useAsyncData('category-page-categories', getCategories);
  const subcategories = useAsyncData('category-page-subcategories', getSubcategories);
  const products = useAsyncData(`category-page-products-${id}`, () => getProducts({ categoryId: id }));

  const category = categories.data?.data.find((item) => item.id === id);
  const categoryName = category?.name ?? 'Category';

  const types = useMemo(
    () => (subcategories.data?.data ?? []).filter((item) => item.categoryId === id),
    [subcategories.data, id]
  );
  const selectedType = types.find((item) => item.id === selectedId);

  const railItems = useMemo<CategoryRailItem[]>(
    () => [
      {
        id: ALL_ID,
        label: 'All',
        imageUrl: category?.imageUrl,
        localArt: getHomeCategoryArt(id),
        fallbackIcon: getCategoryIcon(id, category?.icon),
      },
      ...types.map((item) => ({
        id: item.id,
        label: item.name,
        imageUrl: item.imageUrl,
        localArt: getSubcategoryArt(item.id),
        fallbackIcon: getCategoryIcon(id),
      })),
    ],
    [types, id, category?.imageUrl, category?.icon]
  );

  const allProducts = products.data?.data ?? NO_PRODUCTS;
  const visible = useMemo(
    () => (selectedType ? allProducts.filter((product) => matchesSubcategory(product, selectedType)) : allProducts),
    [allProducts, selectedType]
  );

  const gridWidth = Math.min(screenWidth, MAX_STORE_WIDTH) - CATEGORY_RAIL_WIDTH - GRID_PADDING * 2;
  const columns = gridWidth >= 560 ? 3 : 2;
  const cardWidth = Math.floor((gridWidth - GRID_GAP * (columns - 1)) / columns);

  const isDemo = products.data?.source === 'demo';

  const selectType = useCallback(
    (typeId: string) => router.setParams({ sub: typeId === ALL_ID ? undefined : typeId }),
    [router]
  );

  const openProduct = useCallback(
    (product: Product) => router.push({ pathname: '/products/[id]', params: { id: product.id } }),
    [router]
  );

  const openSearch = () =>
    router.push({ pathname: '/products', params: { categoryId: id, categoryName } });

  const refreshAll = () => {
    products.refresh();
    subcategories.refresh();
  };

  const emptyState =
    products.status === 'loading' ? (
      <View style={styles.skeletonGrid} accessibilityRole="progressbar" accessibilityLabel="Loading products">
        {Array.from({ length: SKELETON_CARDS }, (_, index) => (
          <ProductCardSkeleton key={index} width={cardWidth} />
        ))}
      </View>
    ) : products.status === 'error' ? (
      <StateView
        variant="error"
        compact
        title="Couldn't load products"
        message={getErrorMessage(products.error)}
        actionLabel="Try Again"
        onAction={products.reload}
      />
    ) : selectedType ? (
      <StateView
        variant="empty"
        compact
        icon="cube-outline"
        title={`No ${selectedType.name} available yet`}
        actionLabel={allProducts.length > 0 ? `View all ${categoryName}` : undefined}
        onAction={() => selectType(ALL_ID)}
      />
    ) : (
      <StateView variant="empty" compact icon="cube-outline" title="No products available in this category yet." />
    );

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: categoryName,
          headerRight: () => (
            <View style={styles.headerActions}>
              <IconButton
                icon="search"
                accessibilityLabel={`Search in ${categoryName}`}
                surface="light"
                onPress={openSearch}
              />
              <HeaderCartButton />
            </View>
          ),
        }}
      />
      <HeaderBackFallback fallback="/categories" accessibilityLabel="Back to Categories" />
      <View style={styles.body}>
        <CategoryRail items={railItems} selectedId={selectedId} onSelect={selectType} />
        <FlatList
          key={`columns-${columns}`}
          style={styles.list}
          data={products.status === 'success' ? visible : NO_PRODUCTS}
          numColumns={columns}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ProductCard product={item} width={cardWidth} onOpen={openProduct} onAddToCart={handleAddToCart} />
          )}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={emptyState}
          ListFooterComponent={isDemo ? <DemoDataNotice /> : null}
          ListFooterComponentStyle={styles.footer}
          refreshControl={
            <RefreshControl
              refreshing={products.isRefreshing}
              onRefresh={refreshAll}
              colors={[colors.accent]}
              tintColor={colors.homeInk}
            />
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    maxWidth: MAX_STORE_WIDTH,
    alignSelf: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: GRID_PADDING,
    gap: spacing.xl,
    flexGrow: 1,
  },
  row: {
    gap: GRID_GAP,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: GRID_GAP,
    rowGap: spacing.xl,
  },
  footer: {
    marginTop: spacing.sm,
  },
});
