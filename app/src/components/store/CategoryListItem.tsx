import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { memo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { cardShadow, colors, fonts, radius, spacing } from '@/constants/theme';
import { getHomeCategoryArt } from '@/data/homeCategoryArt';
import type { Category } from '@/types/catalog';
import { getCategoryIcon } from '@/utils/categoryIcon';

type CategoryListItemProps = {
  category: Category;
  subtitle?: string;
  onPress: (category: Category) => void;
};

/** Full-width category row for the Categories tab: photo, name, subtitle and chevron. */
function CategoryListItemComponent({ category, subtitle, onPress }: CategoryListItemProps) {
  const [remoteFailed, setRemoteFailed] = useState(false);
  const localArt = getHomeCategoryArt(category.id);
  const remote = !!category.imageUrl && !remoteFailed;

  return (
    <Pressable
      onPress={() => onPress(category)}
      accessibilityRole="button"
      accessibilityLabel={[category.name, subtitle].filter(Boolean).join(', ')}
      accessibilityHint="Shows products in this category"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.media}>
        {remote ? (
          <Image
            source={{ uri: category.imageUrl }}
            style={styles.image}
            resizeMode="cover"
            onError={() => setRemoteFailed(true)}
          />
        ) : localArt ? (
          <Image source={localArt} style={styles.image} resizeMode="cover" />
        ) : (
          <MaterialCommunityIcons name={getCategoryIcon(category.id, category.icon)} size={28} color={colors.accent} />
        )}
      </View>
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {category.name}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.navy} />
    </Pressable>
  );
}

export const CategoryListItem = memo(CategoryListItemComponent);

export function CategoryListItemSkeleton() {
  return (
    <View style={styles.card} accessibilityElementsHidden importantForAccessibility="no">
      <View style={[styles.media, styles.skeleton]} />
      <View style={styles.text}>
        <View style={[styles.skeletonLine, styles.skeleton]} />
        <View style={[styles.skeletonLine, styles.skeletonLineShort, styles.skeleton]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 80,
    padding: spacing.sm,
    paddingRight: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    ...cardShadow,
  },
  pressed: {
    backgroundColor: colors.navySoft,
  },
  media: {
    width: 72,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  text: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    lineHeight: 21,
    fontFamily: fonts.semiBold,
    color: colors.navy,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  skeleton: {
    backgroundColor: '#EDF1F5',
  },
  skeletonLine: {
    height: 12,
    width: '60%',
    borderRadius: 6,
  },
  skeletonLineShort: {
    width: '35%',
  },
});
