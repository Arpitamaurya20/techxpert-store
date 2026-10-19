import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '@/constants/theme';
import { getHomeCategoryArt } from '@/data/homeCategoryArt';
import { CATEGORY_SHORTCUTS } from '@/data/homeContent';
import type { Category } from '@/types/catalog';
import { getCategoryIcon } from '@/utils/categoryIcon';

type CategoryShortcutsProps = {
  categories: Category[];
  loading: boolean;
  onOpenCategory: (category: Category) => void;
  onViewAll: () => void;
};

function ShortcutArt({ category }: { category: Category }) {
  const [remoteFailed, setRemoteFailed] = useState(false);
  const localArt = getHomeCategoryArt(category.id);

  if (category.imageUrl && !remoteFailed) {
    return (
      <Image
        source={{ uri: category.imageUrl }}
        style={styles.image}
        contentFit="cover"
        onError={() => setRemoteFailed(true)}
      />
    );
  }
  if (localArt) {
    return <Image source={localArt} style={styles.image} contentFit="cover" />;
  }
  return <MaterialCommunityIcons name={getCategoryIcon(category.id, category.icon)} size={24} color={colors.navy} />;
}

/** Two rows of four category shortcuts under the header, ending in "More". */
export function CategoryShortcuts({ categories, loading, onOpenCategory, onViewAll }: CategoryShortcutsProps) {
  const shortcuts = CATEGORY_SHORTCUTS.flatMap(({ categoryId, label }) => {
    const category = categories.find((item) => item.id === categoryId);
    return category ? [{ category, label }] : [];
  });

  return (
    <View style={styles.row}>
      {loading
        ? CATEGORY_SHORTCUTS.map(({ categoryId }) => (
            <View key={categoryId} style={styles.tile} accessibilityElementsHidden importantForAccessibility="no">
              <View style={styles.art} />
              <View style={styles.skeletonLine} />
            </View>
          ))
        : shortcuts.map(({ category, label }) => (
            <Pressable
              key={category.id}
              onPress={() => onOpenCategory(category)}
              accessibilityRole="button"
              accessibilityLabel={`${category.name} category`}
              style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
            >
              <View style={styles.art}>
                <ShortcutArt category={category} />
              </View>
              <Text style={styles.label} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          ))}

      <Pressable
        onPress={onViewAll}
        accessibilityRole="button"
        accessibilityLabel="More categories"
        style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
      >
        <View style={[styles.art, styles.moreArt]}>
          <Ionicons name="grid-outline" size={24} color={colors.navy} />
        </View>
        <Text style={styles.label}>More</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
  },
  tile: {
    width: '23%',
    alignItems: 'center',
    gap: 6,
  },
  pressed: {
    opacity: 0.8,
  },
  art: {
    width: '100%',
    maxWidth: 72,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  moreArt: {
    borderColor: colors.navySoft,
    backgroundColor: colors.navySoft,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.semiBold,
    color: colors.navy,
    textAlign: 'center',
  },
  skeletonLine: {
    width: '70%',
    height: 8,
    marginTop: 3,
    borderRadius: 4,
    backgroundColor: '#EDF1F5',
  },
});
