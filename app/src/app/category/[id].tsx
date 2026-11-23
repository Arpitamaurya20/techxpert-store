import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { FlatList, RefreshControl, StyleSheet, View, useWindowDimensions } from 'react-native';

import { CATEGORY_RAIL_WIDTH, CategoryRail, type CategoryRailItem } from '@/components/store/CategoryRail';
import { DemoDataNotice } from '@/components/store/DemoDataNotice';
import { HeaderCartButton } from '@/components/store/HeaderCartButton';
import { ProductCard, ProductCardSkeleton } from '@/components/store/ProductCard';
import { ProductListFooter } from '@/components/store/ProductListFooter';
import { HeaderBackFallback } from '@/components/ui/HeaderBackFallback';
import { IconButton } from '@/components/ui/IconButton';
import { StateView } from '@/components/ui/StateView';
import { MAX_STORE_WIDTH, colors, spacing } from '@/constants/theme';
import { getHomeCategoryArt } from '@/data/homeCategoryArt';
import { getSubcategoryArt } from '@/data/subcategoryArt';
import { useAddToCart } from '@/hooks/useAddToCart';
import { useAsyncData } from '@/hooks/useAsyncData';
import { PRODUCT_PAGE_SIZE, useProductList } from '@/hooks/useProductList';
import { GRID_GAP } from '@/hooks/useStoreLayout';
import { getErrorMessage } from '@/services/apiClient';
import { getCategories, getSubcategories } from '@/services/productApi';
import type { Product } from '@/types/catalog';
import { getCategoryIcon } from '@/utils/categoryIcon';
import { matchesSubcategory } from '@/utils/subcategoryMatch';

const ALL_ID = 'all';
const GRID_PADDING = spacing.md;
const SKELETON_CARDS = 4;
const NO_PRODUCTS: Product[] = [];
const END_REACHED_THRESHOLD = 0.35;

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
  const {
    items: allProducts,
    status: listStatus,
    error: listError,
    source: listSource,
    hasMore,
    loadingMore,
    isRefreshing,
    isUpdating,
    reload,
    refresh,
    loadMore,
  } = useProductList({ categoryId: id, limit: PRODUCT_PAGE_SIZE });

  const category = categories.data?.data.find((item) => item.id === id);
  const categoryName = category?.name ?? 'Category';
  const catalogueSettled = listStatus === 'success' && !hasMore && !loadingMore;
  const categoryMissing = categories.status === 'success' && !category;
  const categoryEmpty = catalogueSettled && allProducts.length === 0;

  // Empty shelves are filtered from getCategories; if products come back empty, leave — never show an empty list.
  useEffect(() => {
    if (categoryMissing || categoryEmpty) {
      router.replace('/categories');
    }
  }, [categoryMissing, categoryEmpty, router]);

  const allTypes = useMemo(
    () => (subcategories.data?.data ?? []).filter((item) => item.categoryId === id),
    [subcategories.data, id]
  );

  // Once the category catalogue is fully paged, drop product types that matched nothing.
  const types = useMemo(() => {
    if (!catalogueSettled || allProducts.length === 0) return allTypes;
    return allTypes.filter((type) => allProducts.some((product) => matchesSubcategory(product, type)));
  }, [allTypes, catalogueSettled, allProducts]);

  const selectedType = types.find((item) => item.id === selectedId);

  // Selected type was hidden because it had no products — fall back to All.
  useEffect(() => {
    if (selectedId === ALL_ID) return;
    if (!catalogueSettled) return;
    if (types.some((type) => type.id === selectedId)) return;
    router.setParams({ sub: undefined });
  }, [selectedId, catalogueSettled, types, router]);

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

  const visible = useMemo(
    () => (selectedType ? allProducts.filter((product) => matchesSubcategory(product, selectedType)) : allProducts),
    [allProducts, selectedType]
  );

  const gridWidth = Math.min(screenWidth, MAX_STORE_WIDTH) - CATEGORY_RAIL_WIDTH - GRID_PADDING * 2;
  const columns = gridWidth >= 560 ? 3 : 2;
  const cardWidth = Math.floor((gridWidth - GRID_GAP * (columns - 1)) / columns);

  const isDemo = listSource === 'demo';
  const showGrid = listStatus === 'success' || (isUpdating && allProducts.length > 0);
  const leavingEmpty = categoryMissing || categoryEmpty;

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
    refresh();
    subcategories.refresh();
  };

  const onEndReached = useCallback(() => {
    if (listStatus !== 'success') return;
    loadMore();
  }, [listStatus, loadMore]);

  // Subcategory is filtered on the device. Keep paging while the filtered view
  // is short so a sparse type does not look like an empty catalogue.
  useEffect(() => {
    if (!selectedType || listStatus !== 'success' || loadingMore) return;
    if (!hasMore) return;
    if (visible.length >= PRODUCT_PAGE_SIZE) return;
    loadMore();
  }, [selectedType, listStatus, loadingMore, hasMore, loadMore, visible.length]);

  const emptyState = leavingEmpty ? null : listStatus === 'loading' || categories.status === 'loading' ? (
    <View style={styles.skeletonGrid} accessibilityRole="progressbar" accessibilityLabel="Loading products">
      {Array.from({ length: SKELETON_CARDS }, (_, index) => (
        <ProductCardSkeleton key={index} width={cardWidth} />
      ))}
    </View>
  ) : listStatus === 'error' && allProducts.length === 0 ? (
    <StateView
      variant="error"
      compact
      title="Couldn't load products"
      message={getErrorMessage(listError)}
      actionLabel="Try Again"
      onAction={reload}
    />
  ) : selectedType && visible.length === 0 && (hasMore || loadingMore) ? (
    <View style={styles.skeletonGrid} accessibilityRole="progressbar" accessibilityLabel="Loading products">
      {Array.from({ length: SKELETON_CARDS }, (_, index) => (
        <ProductCardSkeleton key={index} width={cardWidth} />
      ))}
    </View>
  ) : null;

  const footer =
    showGrid && allProducts.length > 0 ? (
      <View>
        <ProductListFooter loadingMore={loadingMore} hasMore={hasMore} loadedCount={allProducts.length} />
        {isDemo ? <DemoDataNotice /> : null}
      </View>
    ) : isDemo ? (
      <DemoDataNotice />
    ) : null;

  if (leavingEmpty) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: categoryName }} />
        <HeaderBackFallback fallback="/categories" accessibilityLabel="Back to Categories" />
      </View>
    );
  }

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
          data={showGrid ? visible : NO_PRODUCTS}
          numColumns={columns}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ProductCard product={item} width={cardWidth} onOpen={openProduct} onAddToCart={handleAddToCart} />
          )}
          columnWrapperStyle={columns > 1 ? styles.row : undefined}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={emptyState}
          ListFooterComponent={footer}
          ListFooterComponentStyle={styles.footer}
          onEndReached={onEndReached}
          onEndReachedThreshold={END_REACHED_THRESHOLD}
          initialNumToRender={PRODUCT_PAGE_SIZE}
          maxToRenderPerBatch={PRODUCT_PAGE_SIZE}
          windowSize={7}
          removeClippedSubviews
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
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
