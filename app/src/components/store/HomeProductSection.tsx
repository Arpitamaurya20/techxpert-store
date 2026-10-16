import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ProductCard, ProductCardSkeleton } from '@/components/store/ProductCard';
import { ProductImage } from '@/components/store/ProductImage';
import { StateView } from '@/components/ui/StateView';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { HOME_SECTION_LIMIT, type HomeProductSectionConfig } from '@/data/homeSections';
import { useAsyncData } from '@/hooks/useAsyncData';
import { GRID_GAP } from '@/hooks/useStoreLayout';
import { getErrorMessage } from '@/services/apiClient';
import { getProducts } from '@/services/productApi';
import type { Product } from '@/types/catalog';
import { getCategoryIcon } from '@/utils/categoryIcon';

const PREVIEW_THUMBS = 3;

type HomeProductSectionProps = {
  section: HomeProductSectionConfig;
  cardWidth: number;
  /** Bumped by pull-to-refresh on Home so every section reloads. */
  refreshKey: number;
  onOpenProduct: (product: Product) => void;
  onAddToCart: (product: Product) => void;
};

export function HomeProductSection({
  section,
  cardWidth,
  refreshKey,
  onOpenProduct,
  onAddToCart,
}: HomeProductSectionProps) {
  const router = useRouter();
  const products = useAsyncData(
    `home-section-${section.id}-${refreshKey}`,
    () => getProducts({ ...section.query, limit: HOME_SECTION_LIMIT }),
    { keepPreviousData: true }
  );
  const items = products.data?.data ?? [];

  const seeAll = () =>
    router.push({
      pathname: '/products',
      params: section.query.featured
        ? { featured: 'true' }
        : section.query.categoryId
          ? { categoryId: section.query.categoryId, categoryName: section.title }
          : { brandId: section.query.brandId, brandName: section.title },
    });

  return (
    <View style={styles.section}>
      <Text style={styles.title} accessibilityRole="header">
        {section.title}
      </Text>

      {products.status === 'loading' ? (
        <View style={styles.grid} accessibilityRole="progressbar" accessibilityLabel={`Loading ${section.title}`}>
          <ProductCardSkeleton width={cardWidth} />
          <ProductCardSkeleton width={cardWidth} />
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
      ) : items.length === 0 ? (
        <StateView
          variant="empty"
          compact
          icon="cube-outline"
          title={`No products in ${section.title} yet`}
        />
      ) : (
        <>
          <View style={styles.grid}>
            {items.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                width={cardWidth}
                onOpen={onOpenProduct}
                onAddToCart={onAddToCart}
              />
            ))}
          </View>

          <Pressable
            onPress={seeAll}
            accessibilityRole="button"
            accessibilityLabel={`See all ${section.title}`}
            style={({ pressed }) => [styles.seeAll, pressed && styles.seeAllPressed]}
          >
            <View style={styles.thumbs}>
              {items.slice(0, PREVIEW_THUMBS).map((product, index) => (
                <ProductImage
                  key={product.id}
                  uri={product.imageUrl}
                  fallbackIcon={getCategoryIcon(product.categoryId)}
                  accessibilityLabel={product.name}
                  iconSize={14}
                  style={[styles.thumb, index > 0 && styles.thumbOverlap]}
                />
              ))}
            </View>
            <Text style={styles.seeAllText}>See All</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.homeInk} />
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: fonts.bold,
    color: colors.homeInk,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: GRID_GAP,
    rowGap: spacing.xl,
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  seeAllPressed: {
    backgroundColor: colors.surface,
  },
  thumbs: {
    flexDirection: 'row',
  },
  thumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  thumbOverlap: {
    marginLeft: -8,
  },
  seeAllText: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: fonts.medium,
    color: colors.homeInk,
  },
});
