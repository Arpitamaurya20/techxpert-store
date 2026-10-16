import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { memo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, spacing, typography } from '@/constants/theme';
import type { Category } from '@/types/catalog';
import { getCategoryIcon } from '@/utils/categoryIcon';

const MEDIA_ASPECT_RATIO = 16 / 10;

type CategoryTileProps = {
  category: Category;
  width: number;
  onPress: (category: Category) => void;
};

function formatProductCount(count: number) {
  return `${count.toLocaleString('en-IN')} ${count === 1 ? 'product' : 'products'}`;
}

/** Category card for the Categories grid: image (or icon fallback), name, and optional count/description. */
function CategoryTileComponent({ category, width, onPress }: CategoryTileProps) {
  const [failedUri, setFailedUri] = useState<string | undefined>();
  const showImage = !!category.imageUrl && failedUri !== category.imageUrl;
  const countText =
    category.productCount !== undefined ? formatProductCount(category.productCount) : undefined;

  return (
    <Pressable
      onPress={() => onPress(category)}
      accessibilityRole="button"
      accessibilityLabel={[`${category.name} category`, countText].filter(Boolean).join(', ')}
      accessibilityHint="Shows products in this category"
      style={({ pressed }) => [styles.card, { width }, pressed && styles.pressed]}
    >
      <View style={styles.media}>
        {showImage ? (
          <Image
            source={{ uri: category.imageUrl }}
            style={styles.image}
            resizeMode="cover"
            onError={() => setFailedUri(category.imageUrl)}
          />
        ) : (
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons
              name={getCategoryIcon(category.id, category.icon)}
              size={28}
              color={colors.accent}
            />
          </View>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={2}>
            {category.name}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={styles.chevron} />
        </View>
        {countText ? <Text style={styles.meta}>{countText}</Text> : null}
        {category.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {category.description}
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
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  pressed: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  media: {
    width: '100%',
    aspectRatio: MEDIA_ASPECT_RATIO,
    maxHeight: 132,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  body: {
    gap: 2,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  name: {
    ...typography.label,
    flex: 1,
    color: colors.text,
  },
  chevron: {
    marginTop: 3,
  },
  meta: {
    ...typography.small,
    fontFamily: fonts.semiBold,
    color: colors.accent,
  },
  description: {
    ...typography.small,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  skeletonMedia: {
    backgroundColor: '#EDF1F5',
  },
  skeletonLine: {
    height: 12,
    width: '80%',
    marginVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EDF1F5',
  },
  skeletonLineShort: {
    width: '50%',
  },
});
