import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { cardShadow, colors, fonts, radius, spacing } from '@/constants/theme';
import { getHomeCategoryArt } from '@/data/homeCategoryArt';
import type { Category } from '@/types/catalog';
import { getCategoryIcon } from '@/utils/categoryIcon';

type CategoryTileProps = {
  category: Category;
  width: number;
  /** Extra line under the name (product count, search match, etc.). */
  subtitle?: string;
  onPress: (category: Category) => void;
};

/** Photo-forward category card for the Categories browse grid. */
function CategoryTileComponent({ category, width, subtitle, onPress }: CategoryTileProps) {
  const [remoteFailed, setRemoteFailed] = useState(false);
  const localArt = getHomeCategoryArt(category.id);
  const remote = Boolean(category.imageUrl) && !remoteFailed;
  const countText =
    !subtitle && category.productCount !== undefined
      ? `${category.productCount.toLocaleString('en-IN')} ${category.productCount === 1 ? 'product' : 'products'}`
      : undefined;
  const meta = subtitle || countText;

  return (
    <Pressable
      onPress={() => onPress(category)}
      accessibilityRole="button"
      accessibilityLabel={[`${category.name} category`, meta].filter(Boolean).join(', ')}
      accessibilityHint="Shows products in this category"
      style={({ pressed }) => [styles.card, { width }, pressed && styles.pressed]}
    >
      <View style={styles.media}>
        {remote ? (
          <Image
            source={{ uri: category.imageUrl }}
            style={styles.image}
            contentFit="cover"
            onError={() => setRemoteFailed(true)}
          />
        ) : localArt ? (
          <Image source={localArt} style={styles.image} contentFit="cover" />
        ) : (
          <View style={styles.fallback}>
            <View style={styles.iconBadge}>
              <MaterialCommunityIcons
                name={getCategoryIcon(category.id, category.icon)}
                size={28}
                color={colors.navy}
              />
            </View>
          </View>
        )}
        <View style={styles.mediaScrim} pointerEvents="none" />
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {category.name}
        </Text>
        {meta ? (
          <Text style={styles.meta} numberOfLines={2}>
            {meta}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export const CategoryTile = memo(CategoryTileComponent);

/** Same footprint as a tile, so the grid does not jump when data arrives. */
export function CategoryTileSkeleton({ width }: { width: number }) {
  return (
    <View style={[styles.card, { width }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={[styles.media, styles.skeletonMedia]} />
      <View style={styles.body}>
        <View style={styles.skeletonLine} />
        <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    ...cardShadow,
  },
  pressed: {
    borderColor: colors.navy,
    backgroundColor: colors.navySoft,
  },
  media: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.navySoft,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  mediaScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(7, 28, 61, 0.04)',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.navySoft,
  },
  iconBadge: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  body: {
    gap: 4,
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  name: {
    fontSize: 14,
    lineHeight: 19,
    fontFamily: fonts.semiBold,
    color: colors.navy,
  },
  meta: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  skeletonMedia: {
    backgroundColor: '#EDF1F5',
  },
  skeletonLine: {
    height: 12,
    width: '78%',
    marginVertical: 3,
    borderRadius: 6,
    backgroundColor: '#EDF1F5',
  },
  skeletonLineShort: {
    width: '45%',
  },
});
