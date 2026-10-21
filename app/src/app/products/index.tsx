import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { DemoDataNotice } from '@/components/store/DemoDataNotice';
import { HeaderCartButton } from '@/components/store/HeaderCartButton';
import { HeaderBackFallback } from '@/components/ui/HeaderBackFallback';
import { ProductCard, ProductCardSkeleton } from '@/components/store/ProductCard';
import { ProductFilterSheet } from '@/components/store/ProductFilterSheet';
import { ProductSearchBar } from '@/components/store/ProductSearchBar';
import { ProductSortSheet } from '@/components/store/ProductSortSheet';
import { StateView } from '@/components/ui/StateView';
import type { IconName } from '@/components/ui/TextField';
import { MAX_STORE_WIDTH, SCREEN_PADDING, colors, fonts, radius, spacing, typography } from '@/constants/theme';
import { useAddToCart } from '@/hooks/useAddToCart';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { GRID_GAP, useStoreLayout } from '@/hooks/useStoreLayout';
import { getErrorMessage } from '@/services/apiClient';
import { getCategories, getProducts } from '@/services/productApi';
import type { Product, ProductQuery } from '@/types/catalog';
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
  const debouncedSearch = useDebouncedValue(searchText.trim(), SEARCH_DEBOUNCE_MS);
  const activeSearch = searchText.trim() === '' ? '' : debouncedSearch;

  // Mirror the search in the URL so web refresh and back/forward keep it; the category is never touched.
  useEffect(() => {
    if ((params.search ?? '') !== debouncedSearch) {
      router.setParams({ search: debouncedSearch || undefined });
    }
  }, [debouncedSearch]);

  const query = useMemo<ProductQuery>(
    () => ({
      search: activeSearch || undefined,
      categoryId: params.categoryId || undefined,
      brandId: params.brandId || undefined,
      featured: params.featured === 'true',
    }),
    [activeSearch, params.categoryId, params.brandId, params.featured]
  );

  const products = useAsyncData(JSON.stringify(query), () => getProducts(query), {
    keepPreviousData: true,
  });
  const categories = useAsyncData(`category-${params.categoryId ?? ''}`, (options) =>
    params.categoryId ? getCategories(options) : Promise.resolve(null)
  );
  const category = categories.data?.data.find((item) => item.id === params.categoryId);

  const loaded = products.data?.data ?? NO_PRODUCTS;
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

  const categoryName = params.categoryName ?? category?.name;
  const title =
    categoryName ??
    (activeSearch
      ? 'Search Results'
      : (params.brandName ?? (query.featured ? 'Featured Products' : 'All Products')));

  const openProduct = useCallback(
    (product: Product) => router.push({ pathname: '/products/[id]', params: { id: product.id } }),
    [router]
  );

  const clearSearch = () => setSearchText('');
  const clearFilters = () => setFilters(EMPTY_FILTERS);

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
    ...(query.featured
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
      ? `${visible.length} of ${loaded.length} ${productWord}`
      : `${loaded.length} ${productWord}${activeSearch ? ` for “${activeSearch}”` : ''}`;

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

      {products.data?.source === 'demo' ? <DemoDataNotice /> : null}

      {products.status === 'success' && loaded.length > 0 ? (
        <View style={styles.toolbar}>
          <View style={styles.countRow}>
            <Text style={styles.count} numberOfLines={1}>
              {countLabel}
            </Text>
            {products.isUpdating ? <ActivityIndicator size="small" color={colors.accent} /> : null}
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
    products.status === 'loading' ? (
      <View style={styles.skeletonGrid} accessibilityRole="progressbar" accessibilityLabel="Loading products">
        {Array.from({ length: SKELETON_ROWS }, (_, row) => (
          <View key={row} style={styles.skeletonRow}>
            {Array.from({ length: layout.productColumns }, (_, column) => (
              <ProductCardSkeleton key={column} width={layout.productCardWidth} />
            ))}
          </View>
        ))}
      </View>
    ) : products.status === 'error' ? (
      <StateView
        variant="error"
        title="Couldn't load products"
        message={getErrorMessage(products.error)}
        actionLabel="Try Again"
        onAction={products.reload}
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
        <StateView
          variant="empty"
          icon="cube-outline"
          title="No products available in this category yet."
          actionLabel="Browse Categories"
          onAction={() => router.navigate('/home')}
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
        data={products.status === 'success' ? visible : NO_PRODUCTS}
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
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={products.isRefreshing}
            onRefresh={products.refresh}
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
