import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { memo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, spacing, typography } from '@/constants/theme';
import { getHomeCategoryArt } from '@/data/homeCategoryArt';
import type { Category } from '@/types/catalog';
import { getCategoryIcon } from '@/utils/categoryIcon';

export const HOME_CATEGORY_TILE_SIZE = 100;

type CategoryCardProps = {
  category: Category;
  onPress: (category: Category) => void;
  /** Defaults to the compact Home strip size. Pass grid column width on Categories. */
  width?: number;
};

function CategoryCardComponent({
  category,
  onPress,
  width = HOME_CATEGORY_TILE_SIZE,
}: CategoryCardProps) {
  const [remoteFailed, setRemoteFailed] = useState(false);
  const localArt = getHomeCategoryArt(category.id);
  const remote = !!category.imageUrl && !remoteFailed;

  return (
    <Pressable
      onPress={() => onPress(category)}
      accessibilityRole="button"
      accessibilityLabel={`${category.name} category`}
      accessibilityHint="Shows products in this category"
      style={({ pressed }) => [styles.wrap, { width }, pressed && styles.pressed]}
    >
      <View style={styles.tile}>
        {remote ? (
          <Image
            source={{ uri: category.imageUrl }}
            style={styles.image}
            resizeMode="contain"
            onError={() => setRemoteFailed(true)}
          />
        ) : localArt ? (
          <Image source={localArt} style={styles.image} resizeMode="contain" />
        ) : (
          <MaterialCommunityIcons
            name={getCategoryIcon(category.id, category.icon)}
            size={36}
            color={colors.accent}
          />
        )}
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {category.name}
      </Text>
    </Pressable>
  );
}

export const CategoryCard = memo(CategoryCardComponent);

export function CategoryCardSkeleton({ width = HOME_CATEGORY_TILE_SIZE }: { width?: number }) {
  return (
    <View style={[styles.wrap, { width }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={[styles.tile, styles.skeletonTile]} />
      <View style={styles.skeletonLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.85,
  },
  tile: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  name: {
    ...typography.small,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    lineHeight: 16,
    color: colors.homeInk,
    textAlign: 'center',
    width: '100%',
    minHeight: 32,
  },
  skeletonTile: {
    backgroundColor: '#EDF1F5',
  },
  skeletonLine: {
    height: 10,
    width: '70%',
    borderRadius: 6,
    backgroundColor: '#EDF1F5',
    marginTop: 2,
  },
});
