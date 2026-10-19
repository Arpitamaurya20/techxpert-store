import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CategoryListItem, CategoryListItemSkeleton } from '@/components/store/CategoryListItem';
import { HeaderBackFallback } from '@/components/ui/HeaderBackFallback';
import { StateView } from '@/components/ui/StateView';
import { MAX_STORE_WIDTH, SCREEN_PADDING, colors, fonts, radius, spacing } from '@/constants/theme';
import { getShopProject } from '@/data/homeContent';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useStatusBarStyle } from '@/hooks/useStatusBarStyle';
import { getErrorMessage } from '@/services/apiClient';
import { getCategories, getSubcategories } from '@/services/productApi';
import type { CalculatorMode } from '@/utils/materialEstimates';

const CALCULATOR_FOR_PROJECT: Partial<Record<string, CalculatorMode>> = {
  painting: 'paint',
  flooring: 'tiles',
  bathroom: 'tiles',
  construction: 'cement',
};

export default function ProjectScreen() {
  useStatusBarStyle('dark');
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const project = getShopProject(id);

  const categories = useAsyncData('project-categories', getCategories);
  const subcategories = useAsyncData('project-subcategories', getSubcategories);

  if (!project) {
    return (
      <>
        <Stack.Screen options={{ title: 'Project' }} />
        <StateView
          variant="empty"
          icon="construct-outline"
          title="Project not found"
          actionLabel="Back to Home"
          onAction={() => router.replace('/home')}
        />
      </>
    );
  }

  const calculatorMode = CALCULATOR_FOR_PROJECT[project.id];
  const allCategories = categories.data?.data ?? [];
  const projectCategories = project.categoryIds.flatMap((categoryId) => {
    const category = allCategories.find((item) => item.id === categoryId);
    return category ? [category] : [];
  });
  const typeCount = (categoryId: string) =>
    (subcategories.data?.data ?? []).filter((item) => item.categoryId === categoryId).length;

  const renderList = () => {
    if (categories.status === 'loading') {
      return project.categoryIds.map((categoryId) => <CategoryListItemSkeleton key={categoryId} />);
    }
    if (categories.status === 'error') {
      return (
        <StateView
          variant="error"
          compact
          title="Couldn't load categories"
          message={getErrorMessage(categories.error)}
          actionLabel="Try Again"
          onAction={categories.reload}
        />
      );
    }
    if (projectCategories.length === 0) {
      return <StateView variant="empty" compact icon="grid-outline" title="No categories for this project yet" />;
    }
    return projectCategories.map((category) => {
      const types = typeCount(category.id);
      return (
        <CategoryListItem
          key={category.id}
          category={category}
          subtitle={types > 0 ? `${types} ${types === 1 ? 'type' : 'types'}` : undefined}
          onPress={() => router.push({ pathname: '/category/[id]', params: { id: category.id } })}
        />
      );
    });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: project.title }} />
      <HeaderBackFallback fallback="/home" accessibilityLabel="Back to Home" />
      <View style={styles.inner}>
        <View style={styles.hero}>
          <Image source={project.image} style={styles.heroImage} contentFit="cover" accessible={false} />
          <View style={styles.heroText}>
            <Text style={styles.heroTitle} accessibilityRole="header">
              {project.title}
            </Text>
            <Text style={styles.heroSubtitle}>{project.subtitle}</Text>
          </View>
        </View>

        {calculatorMode ? (
          <Pressable
            onPress={() => router.push({ pathname: '/calculator', params: { mode: calculatorMode } })}
            accessibilityRole="button"
            accessibilityLabel="Estimate how much material you need"
            style={({ pressed }) => [styles.calculator, pressed && styles.calculatorPressed]}
          >
            <Ionicons name="calculator-outline" size={20} color={colors.accent} />
            <Text style={styles.calculatorText}>Estimate how much you need</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.accent} />
          </Pressable>
        ) : null}

        <Text style={styles.sectionTitle} accessibilityRole="header">
          What you&apos;ll need
        </Text>
        <View style={styles.list}>{renderList()}</View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screen,
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
  hero: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    backgroundColor: colors.navy,
  },
  heroImage: {
    width: '100%',
    height: 150,
  },
  heroText: {
    gap: 2,
    padding: spacing.lg,
  },
  heroTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: fonts.bold,
    color: colors.white,
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.regular,
    color: colors.textOnDark,
  },
  calculator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#FAD9C6',
    backgroundColor: colors.accentSoft,
  },
  calculatorPressed: {
    opacity: 0.85,
  },
  calculatorText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.semiBold,
    color: colors.accent,
  },
  sectionTitle: {
    marginTop: spacing.xs,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: fonts.bold,
    color: colors.navy,
  },
  list: {
    gap: spacing.sm,
  },
});
