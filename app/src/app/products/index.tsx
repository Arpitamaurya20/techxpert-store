import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { DemoDataNotice } from '@/components/store/DemoDataNotice';
import { HeaderCartButton } from '@/components/store/HeaderCartButton';
import { ProductCard, ProductCardSkeleton } from '@/components/store/ProductCard';
import { ProductFilterSheet } from '@/components/store/ProductFilterSheet';
import { ProductListFooter } from '@/components/store/ProductListFooter';
import { ProductSearchBar } from '@/components/store/ProductSearchBar';
import { ProductSortSheet } from '@/components/store/ProductSortSheet';
import { HeaderBackFallback } from '@/components/ui/HeaderBackFallback';
import { StateView } from '@/components/ui/StateView';
import type { IconName } from '@/components/ui/TextField';
import { MAX_STORE_WIDTH, SCREEN_PADDING, colors, fonts, radius, spacing, typography } from '@/constants/theme';
import { useAddToCart } from '@/hooks/useAddToCart';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { PRODUCT_PAGE_SIZE, useProductList } from '@/hooks/useProductList';
import { GRID_GAP, useStoreLayout } from '@/hooks/useStoreLayout';
import { getErrorMessage } from '@/services/apiClient';
import { getCategories } from '@/services/productApi';
import type { Product } from '@/types/catalog';
import { formatPrice } from '@/utils/format';
import {
  EMPTY_FILTERS,
  SORT_LABELS,
  applyFilters,
  countActiveFilters,
  getAvailableSorts,
  getFilterOptions,
  sortProducts,
  type ProductFilters,
  type ProductSort,
} from '@/utils/productListing';

type ProductListParams = {
  search?: string;
  categoryId?: string;
  categoryName?: string;
  brandId?: string;
  brandName?: string;
  featured?: string;
};

type Chip = { key: string; label: string; onRemove: () => void };

const SEARCH_DEBOUNCE_MS = 350;
const SKELETON_ROWS = 2;
const NO_PRODUCTS: Product[] = [];
const END_REACHED_THRESHOLD = 0.35;

export default function ProductListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<ProductListParams>();
  const layout = useStoreLayout();
  const handleAddToCart = useAddToCart();

  const [searchText, setSearchText] = useState(params.search ?? '');
  const [sort, setSort] = useState<ProductSort>('default');
  const [filters, setFilters] = useState<ProductFilters>(EMPTY_FILTERS);
  const [openSheet, setOpenSheet] = useState<'sort' | 'filter' | null>(null);

  // Typing is debounced so the API gets one request per pause, but clearing is instant.
  // Card search needs at least 2 characters (docs UC-3); shorter queries stay local-only.
  const debouncedSearch = useDebouncedValue(searchText.trim(), SEARCH_DEBOUNCE_MS);
  const activeSearch =
    searchText.trim() === ''
      ? ''
      : debouncedSearch.length >= 2
        ? debouncedSearch
        : '';

  // Mirror the search in the URL so web refresh and back/forward keep it; the category is never touched.
  useEffect(() => {
    if ((params.search ?? '') !== debouncedSearch) {
      router.setParams({ search: debouncedSearch || undefined });
    }
  }, [debouncedSearch, params.search, router]);

  const listQuery = useMemo(
    () => ({
      search: activeSearch || undefined,
      categoryId: params.categoryId || undefined,
      brandId: params.brandId || undefined,
      featured: params.featured === 'true' ? true : undefined,
      limit: PRODUCT_PAGE_SIZE,
    }),
    [activeSearch, params.categoryId, params.brandId, params.featured]
  );

  const products = useProductList(listQuery);
  const {
    items: loaded,
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
  } = products;
  const categories = useAsyncData(`category-${params.categoryId ?? ''}`, (options) =>
    params.categoryId ? getCategories(options) : Promise.resolve(null)
  );
  const category = categories.data?.data.find((item) => item.id === params.categoryId);

  // Empty category product pages: leave instead of showing a permanent empty list.
  useEffect(() => {
    if (!params.categoryId) return;
    if (listStatus !== 'success' || hasMore || loadingMore) return;
    if (loaded.length > 0) return;
    router.replace('/categories');
  }, [params.categoryId, listStatus, hasMore, loadingMore, loaded.length, router]);
  const filterOptions = useMemo(() => getFilterOptions(loaded), [loaded]);
  const sortOptions = useMemo(() => getAvailableSorts(loaded), [loaded]);
  const effectiveSort = sortOptions.includes(sort) ? sort : 'default';
  const visible = useMemo(
    () => sortProducts(applyFilters(loaded, filters), effectiveSort),
    [loaded, filters, effectiveSort]
  );
  const activeFilterCount = countActiveFilters(filters);
  const canFilter =
    filterOptions.brands.length > 0 || filterOptions.priceRange !== null || filterOptions.hasStockInfo;

  const isFeatured = params.featured === 'true';
  const categoryName = params.categoryName ?? category?.name;
  const title =
    categoryName ??
    (activeSearch
      ? 'Search Results'
      : (params.brandName ?? (isFeatured ? 'Featured Products' : 'All Products')));

  const openProduct = useCallback(
    (product: Product) => router.push({ pathname: '/products/[id]', params: { id: product.id } }),
    [router]
  );

  const clearSearch = () => setSearchText('');
  const clearFilters = () => setFilters(EMPTY_FILTERS);

  const onEndReached = useCallback(() => {
    if (listStatus !== 'success') return;
    loadMore();
  }, [listStatus, loadMore]);

  const chips: Chip[] = [
    ...(params.brandId && params.brandName
      ? [
          {
            key: 'param-brand',
            label: params.brandName,
            onRemove: () => router.setParams({ brandId: undefined, brandName: undefined }),
          },
        ]
      : []),
    ...(isFeatured
      ? [{ key: 'param-featured', label: 'Featured', onRemove: () => router.setParams({ featured: undefined }) }]
      : []),
    ...filters.brands.map((key) => ({
      key: `brand-${key}`,
      label: filterOptions.brands.find((brand) => brand.key === key)?.name ?? key,
      onRemove: () => setFilters((current) => ({ ...current, brands: current.brands.filter((b) => b !== key) })),
    })),
    ...(filters.minPrice !== undefined || filters.maxPrice !== undefined
      ? [
          {
            key: 'price',
            label:
              filters.minPrice !== undefined && filters.maxPrice !== undefined
                ? `${formatPrice(filters.minPrice)} – ${formatPrice(filters.maxPrice)}`
                : filters.minPrice !== undefined
                  ? `From ${formatPrice(filters.minPrice)}`
                  : `Up to ${formatPrice(filters.maxPrice!)}`,
            onRemove: () =>
              setFilters((current) => ({ ...current, minPrice: undefined, maxPrice: undefined })),
          },
        ]
      : []),
    ...(filters.inStockOnly
      ? [
          {
            key: 'stock',
            label: 'In stock only',
            onRemove: () => setFilters((current) => ({ ...current, inStockOnly: false })),
          },
        ]
      : []),
  ];

  const productWord = loaded.length === 1 ? 'product' : 'products';
  const countLabel =
    activeFilterCount > 0
      ? `${visible.length} of ${loaded.length} loaded`
      : hasMore
        ? `Showing ${loaded.length}+ ${productWord}${activeSearch ? ` for “${activeSearch}”` : ''}`
        : `${loaded.length} ${productWord}${activeSearch ? ` for “${activeSearch}”` : ''}`;

  const showGrid = listStatus === 'success' || (isUpdating && loaded.length > 0);
  const listData = showGrid ? visible : NO_PRODUCTS;

  const header = (
    <View style={styles.header}>
      {category?.description ? <Text style={styles.description}>{category.description}</Text> : null}

      <ProductSearchBar
        value={searchText}
        onChangeText={setSearchText}
        onSubmit={setSearchText}
        placeholder={params.categoryId ? 'Search products in this category' : undefined}
        accessibilityLabel={categoryName ? `Search products in ${categoryName}` : 'Search products'}
      />

      {chips.length > 0 ? (
        <View style={styles.chips}>
          {chips.map((chip) => (
            <Pressable
              key={chip.key}
              onPress={chip.onRemove}
              accessibilityRole="button"
              accessibilityLabel={`Remove filter ${chip.label}`}
              style={({ pressed }) => [styles.chip, pressed && styles.pressedFade]}
            >
              <Text style={styles.chipLabel}>{chip.label}</Text>
              <Ionicons name="close" size={14} color={colors.accent} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {listSource === 'demo' ? <DemoDataNotice /> : null}

      {showGrid && loaded.length > 0 ? (
        <View style={styles.toolbar}>
          <View style={styles.countRow}>
            <Text style={styles.count} numberOfLines={1}>
              {countLabel}
            </Text>
            {isUpdating ? <ActivityIndicator size="small" color={colors.accent} /> : null}
          </View>
          <View style={styles.toolbarActions}>
            <ToolbarButton
              icon="swap-vertical"
              label="Sort"
              accessibilityLabel={`Sort, currently ${SORT_LABELS[effectiveSort]}`}
              active={effectiveSort !== 'default'}
              onPress={() => setOpenSheet('sort')}
            />
            {canFilter ? (
              <ToolbarButton
                icon="options-outline"
                label="Filter"
                accessibilityLabel={
                  activeFilterCount > 0 ? `Filter, ${activeFilterCount} active` : 'Filter'
                }
                active={activeFilterCount > 0}
                badge={activeFilterCount}
                onPress={() => setOpenSheet('filter')}
              />
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );

  const emptyState =
    listStatus === 'loading' ? (
      <View style={styles.skeletonGrid} accessibilityRole="progressbar" accessibilityLabel="Loading products">
        {Array.from({ length: SKELETON_ROWS }, (_, row) => (
          <View key={row} style={styles.skeletonRow}>
            {Array.from({ length: layout.productColumns }, (_, column) => (
              <ProductCardSkeleton key={column} width={layout.productCardWidth} />
            ))}
          </View>
        ))}
      </View>
    ) : listStatus === 'error' && loaded.length === 0 ? (
      <StateView
        variant="error"
        title="Couldn't load products"
        message={getErrorMessage(listError)}
        actionLabel="Try Again"
        onAction={reload}
      />
    ) : loaded.length === 0 ? (
      activeSearch ? (
        <StateView
          variant="empty"
          title="No products match your search."
          message={`Nothing found for “${activeSearch}”. Check the spelling or try a shorter word.`}
          actionLabel="Clear Search"
          onAction={clearSearch}
        />
      ) : params.categoryId ? (
        // Empty category shelves are hidden from browse; leave this route instead of an empty list.
        <StateView
          variant="empty"
          icon="grid-outline"
          title="This category isn't available"
          actionLabel="Browse Categories"
          onAction={() => router.replace('/categories')}
        />
      ) : (
        <StateView
          variant="empty"
          icon="cube-outline"
          title="No products found"
          actionLabel={chips.length > 0 ? 'View All Products' : undefined}
          onAction={() => router.setParams({ brandId: undefined, brandName: undefined, featured: undefined })}
        />
      )
    ) : (
      <StateView
        variant="empty"
        icon="options-outline"
        title="No products match the selected filters."
        message="Try a wider price range or remove a filter."
        actionLabel="Clear Filters"
        onAction={clearFilters}
      />
    );

  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerRight: () => <HeaderCartButton />,
        }}
      />
      <HeaderBackFallback
        fallback={params.categoryId ? '/categories' : '/home'}
        accessibilityLabel={params.categoryId ? 'Back to Categories' : 'Back to Home'}
      />
      <FlatList
        key={`columns-${layout.productColumns}`}
        data={listData}
        numColumns={layout.productColumns}
        keyExtractor={(product) => product.id}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            width={layout.productCardWidth}
            onOpen={openProduct}
            onAddToCart={handleAddToCart}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={emptyState}
        ListFooterComponent={
          showGrid && loaded.length > 0 ? (
            <ProductListFooter loadingMore={loadingMore} hasMore={hasMore} loadedCount={loaded.length} />
          ) : null
        }
        columnWrapperStyle={layout.productColumns > 1 ? styles.row : undefined}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onEndReached={onEndReached}
        onEndReachedThreshold={END_REACHED_THRESHOLD}
        initialNumToRender={PRODUCT_PAGE_SIZE}
        maxToRenderPerBatch={PRODUCT_PAGE_SIZE}
        windowSize={7}
        removeClippedSubviews
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            colors={[colors.accent]}
            tintColor={colors.accent}
          />
        }
      />

      <ProductSortSheet
        visible={openSheet === 'sort'}
        options={sortOptions}
        value={effectiveSort}
        onChange={setSort}
        onClose={() => setOpenSheet(null)}
      />
      {openSheet === 'filter' ? (
        <ProductFilterSheet
          options={filterOptions}
          value={filters}
          onApply={setFilters}
          onClose={() => setOpenSheet(null)}
        />
      ) : null}
    </>
  );
}

type ToolbarButtonProps = {
  icon: IconName;
  label: string;
  accessibilityLabel: string;
  active: boolean;
  badge?: number;
  onPress: () => void;
};

function ToolbarButton({ icon, label, accessibilityLabel, active, badge = 0, onPress }: ToolbarButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.toolbarButton,
        active && styles.toolbarButtonActive,
        pressed && styles.pressedFade,
      ]}
    >
      <Ionicons name={icon} size={16} color={active ? colors.accent : colors.primary} />
      <Text style={[styles.toolbarLabel, active && styles.toolbarLabelActive]}>{label}</Text>
      {badge > 0 ? (
        <View style={styles.toolbarBadge}>
          <Text style={styles.toolbarBadgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: MAX_STORE_WIDTH,
    alignSelf: 'center',
    padding: SCREEN_PADDING,
    paddingBottom: spacing.xxl,
    gap: GRID_GAP,
  },
  row: {
    gap: GRID_GAP,
  },
  header: {
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  description: {
    ...typography.caption,
    color: colors.textMuted,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  pressedFade: {
    opacity: 0.7,
  },
  chipLabel: {
    ...typography.small,
    fontFamily: fonts.semiBold,
    color: colors.accent,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  countRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  count: {
    ...typography.caption,
    flexShrink: 1,
    color: colors.textMuted,
  },
  toolbarActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  toolbarButtonActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  toolbarLabel: {
    ...typography.small,
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },
  toolbarLabelActive: {
    color: colors.accent,
  },
  toolbarBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  toolbarBadgeText: {
    fontSize: 10,
    lineHeight: 14,
    fontFamily: fonts.semiBold,
    color: colors.white,
  },
  skeletonGrid: {
    gap: GRID_GAP,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: GRID_GAP,
  },
});
