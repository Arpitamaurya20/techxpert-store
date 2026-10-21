import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CategoryListItem, CategoryListItemSkeleton } from '@/components/store/CategoryListItem';
import { DemoDataNotice } from '@/components/store/DemoDataNotice';
import { StoreHeader } from '@/components/store/StoreHeader';
import { StateView } from '@/components/ui/StateView';
import { MAX_STORE_WIDTH, SCREEN_PADDING, colors, fonts, spacing } from '@/constants/theme';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useStatusBarStyle } from '@/hooks/useStatusBarStyle';
import { getErrorMessage } from '@/services/apiClient';
import { getCategories, getSubcategories } from '@/services/productApi';
import type { Category, Subcategory } from '@/types/catalog';

const SKELETON_ROWS = 6;

type CategoryRow = {
  category: Category;
  subtitle?: string;
  /** Set when the search matched exactly one product type, so the tap opens it directly. */
  subId?: string;
};

function countText(category: Category, types: Subcategory[]) {
  if (category.productCount !== undefined) {
    const count = category.productCount;
    return `${count.toLocaleString('en-IN')} ${count === 1 ? 'Product' : 'Products'}`;
  }
  if (types.length > 0) {
    return `${types.length} ${types.length === 1 ? 'type' : 'types'}`;
  }
  return undefined;
}

export default function CategoriesScreen() {
  useStatusBarStyle('dark');
  const router = useRouter();
  const [query, setQuery] = useState('');

  const categories = useAsyncData('categories-tab', getCategories);
  const subcategories = useAsyncData('categories-tab-subcategories', getSubcategories);

  const isDemo = categories.data?.source === 'demo' || subcategories.data?.source === 'demo';
  const isLoading = categories.status === 'loading' || subcategories.status === 'loading';
  const failed = categories.status === 'error' ? categories : subcategories.status === 'error' ? subcategories : null;

  const rows = useMemo<CategoryRow[]>(() => {
    const byCategory = new Map<string, Subcategory[]>();
    for (const item of subcategories.data?.data ?? []) {
      byCategory.set(item.categoryId, [...(byCategory.get(item.categoryId) ?? []), item]);
    }
    const term = query.trim().toLowerCase();
    const result: CategoryRow[] = [];
    for (const category of categories.data?.data ?? []) {
      const types = byCategory.get(category.id) ?? [];
      if (!term || category.name.toLowerCase().includes(term)) {
        result.push({ category, subtitle: countText(category, types) });
        continue;
      }
      const matches = types.filter((type) =>
        [type.name, type.searchTerm].some((text) => text?.toLowerCase().includes(term))
      );
      if (matches.length > 0) {
        result.push({
          category,
          subtitle: `Includes ${matches.map((type) => type.name).join(', ')}`,
          subId: matches.length === 1 ? matches[0].id : undefined,
        });
      }
    }
    return result;
  }, [categories.data, subcategories.data, query]);

  const openRow = useCallback(
    (row: CategoryRow) =>
      router.push({
        pathname: '/category/[id]',
        params: row.subId ? { id: row.category.id, sub: row.subId } : { id: row.category.id },
      }),
    [router]
  );

  const refreshAll = () => {
    categories.refresh();
    subcategories.refresh();
  };

  const renderList = () => {
    if (isLoading) {
      return (
        <View style={styles.list} accessibilityRole="progressbar" accessibilityLabel="Loading categories">
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <CategoryListItemSkeleton key={index} />
          ))}
        </View>
      );
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
    if ((categories.data?.data ?? []).length === 0) {
      return <StateView variant="empty" icon="grid-outline" title="No categories available yet" />;
    }
    if (rows.length === 0) {
      return (
        <StateView
          variant="empty"
          icon="search-outline"
          title="No matching categories"
          message={`Nothing matches “${query.trim()}”.`}
          actionLabel="Clear search"
          onAction={() => setQuery('')}
        />
      );
    }
    return (
      <View style={styles.list}>
        {rows.map((row) => (
          <CategoryListItem
            key={row.category.id}
            category={row.category}
            subtitle={row.subtitle}
            onPress={() => openRow(row)}
          />
        ))}
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      stickyHeaderIndices={[0]}
      refreshControl={
        <RefreshControl
          refreshing={categories.isRefreshing || subcategories.isRefreshing}
          onRefresh={refreshAll}
          colors={[colors.orange]}
          tintColor={colors.navy}
          progressBackgroundColor={colors.card}
        />
      }
    >
      <StoreHeader
        search={{
          value: query,
          onChangeText: setQuery,
          onSubmit: () => {
            if (rows.length === 1) openRow(rows[0]);
          },
          placeholder: 'Search categories...',
          accessibilityLabel: 'Search categories',
        }}
      />

      <View style={styles.body}>
        <Text style={styles.title} accessibilityRole="header">
          Categories
        </Text>
        {renderList()}
        {isDemo && !isLoading ? <DemoDataNotice /> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screen,
  },
  title: {
    fontSize: 20,
    lineHeight: 28,
    fontFamily: fonts.bold,
    color: colors.navy,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  body: {
    width: '100%',
    maxWidth: MAX_STORE_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  list: {
    gap: spacing.sm,
  },
});
