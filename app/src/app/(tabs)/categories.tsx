import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CategoryCard } from '@/components/store/CategoryCard';
import { DemoDataNotice } from '@/components/store/DemoDataNotice';
import { HeaderFade } from '@/components/store/HeaderFade';
import { ProductSearchBar } from '@/components/store/ProductSearchBar';
import { StoreHeader } from '@/components/store/StoreHeader';
import { StoreLogoBar } from '@/components/store/StoreLogoBar';
import { SubcategoryTile, SubcategoryTileSkeleton } from '@/components/store/SubcategoryTile';
import { StateView } from '@/components/ui/StateView';
import { MAX_STORE_WIDTH, SCREEN_PADDING, colors, fonts, spacing } from '@/constants/theme';
import { useAsyncData } from '@/hooks/useAsyncData';
import { usePinnedSearch } from '@/hooks/usePinnedSearch';
import { useStatusBarStyle } from '@/hooks/useStatusBarStyle';
import { GRID_GAP, useStoreLayout } from '@/hooks/useStoreLayout';
import { getErrorMessage } from '@/services/apiClient';
import { getCategories, getSubcategories } from '@/services/productApi';
import type { Category, Subcategory } from '@/types/catalog';

const SKELETON_SECTIONS = 2;
const SKELETON_TILES = 4;

export default function CategoriesScreen() {
  useStatusBarStyle('dark');
  const router = useRouter();
  const layout = useStoreLayout();
  const [searchText, setSearchText] = useState('');
  const pinnedSearch = usePinnedSearch();
  const searchBar = (
    <ProductSearchBar
      value={searchText}
      onChangeText={setSearchText}
      onSubmit={(search) => router.push({ pathname: '/products', params: { search } })}
      placeholder="What do you need today?"
      shape="pill"
    />
  );

  const categories = useAsyncData('categories-tab', getCategories);
  const subcategories = useAsyncData('categories-tab-subcategories', getSubcategories);

  const categoryList = categories.data?.data ?? [];
  const isDemo = categories.data?.source === 'demo' || subcategories.data?.source === 'demo';
  const isLoading = categories.status === 'loading' || subcategories.status === 'loading';
  const failed = categories.status === 'error' ? categories : subcategories.status === 'error' ? subcategories : null;

  const byCategory = useMemo(() => {
    const groups = new Map<string, Subcategory[]>();
    for (const item of subcategories.data?.data ?? []) {
      groups.set(item.categoryId, [...(groups.get(item.categoryId) ?? []), item]);
    }
    return groups;
  }, [subcategories.data]);

  const refreshAll = () => {
    categories.refresh();
    subcategories.refresh();
  };

  const openCategory = useCallback(
    (category: Category) => router.push({ pathname: '/category/[id]', params: { id: category.id } }),
    [router]
  );

  const openSubcategory = useCallback(
    (subcategory: Subcategory) =>
      router.push({ pathname: '/category/[id]', params: { id: subcategory.categoryId, sub: subcategory.id } }),
    [router]
  );

  const renderSections = () => {
    if (isLoading) {
      return Array.from({ length: SKELETON_SECTIONS }, (_, section) => (
        <View key={section} style={styles.section} accessibilityRole="progressbar" accessibilityLabel="Loading categories">
          <View style={styles.skeletonTitle} />
          <View style={styles.grid}>
            {Array.from({ length: SKELETON_TILES }, (_, tile) => (
              <SubcategoryTileSkeleton key={tile} width={layout.categoryTileWidth} />
            ))}
          </View>
        </View>
      ));
    }
    if (failed) {
      return (
        <StateView
          variant="error"
          title="Couldn't load categories"
          message={getErrorMessage(failed.error)}
          actionLabel="Try Again"
          onAction={() => {
            categories.reload();
            subcategories.reload();
          }}
        />
      );
    }
    if (categoryList.length === 0) {
      return <StateView variant="empty" icon="grid-outline" title="No categories available yet" />;
    }
    return categoryList.map((category) => {
      const items = byCategory.get(category.id) ?? [];
      return (
        <View key={category.id} style={styles.section}>
          <Pressable
            onPress={() => openCategory(category)}
            accessibilityRole="button"
            accessibilityLabel={`See all ${category.name}`}
            style={({ pressed }) => [styles.titleRow, pressed && styles.titlePressed]}
          >
            <Text style={styles.sectionTitle} accessibilityRole="header">
              {category.name}
            </Text>
            <View style={styles.seeAll}>
              <Text style={styles.seeAllText}>See all</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.accent} />
            </View>
          </Pressable>
          <View style={styles.grid}>
            {items.length > 0 ? (
              items.map((item) => (
                <SubcategoryTile
                  key={item.id}
                  subcategory={item}
                  width={layout.categoryTileWidth}
                  onPress={openSubcategory}
                />
              ))
            ) : (
              <CategoryCard category={category} width={layout.categoryTileWidth} onPress={openCategory} />
            )}
          </View>
        </View>
      );
    });
  };

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
          refreshing={categories.isRefreshing || subcategories.isRefreshing}
          onRefresh={refreshAll}
          colors={[colors.accent]}
          tintColor={colors.homeInk}
          progressBackgroundColor={colors.card}
        />
      }
    >
      <StoreLogoBar search={searchBar} showSearch={pinnedSearch.isSearchPinned} />
      <StoreHeader onSearchLayout={pinnedSearch.onSearchLayout}>{searchBar}</StoreHeader>
      <HeaderFade style={styles.headerFade} />

      <View style={styles.body}>
        {renderSections()}
        {isDemo && !isLoading ? <DemoDataNotice /> : null}
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
  /** Overlaps the top padding of the body so the fade adds no extra space. */
  headerFade: {
    marginBottom: -32,
  },
  body: {
    width: '100%',
    maxWidth: MAX_STORE_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: spacing.xl,
    gap: spacing.xl,
  },
  section: {
    gap: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 32,
  },
  titlePressed: {
    opacity: 0.7,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 20,
    lineHeight: 26,
    fontFamily: fonts.bold,
    color: colors.homeInk,
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.semiBold,
    color: colors.accent,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: GRID_GAP,
    rowGap: spacing.lg,
  },
  skeletonTitle: {
    height: 18,
    width: '45%',
    borderRadius: 6,
    backgroundColor: '#EDF1F5',
  },
});
