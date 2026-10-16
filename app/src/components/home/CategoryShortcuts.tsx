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

/** One row of category shortcuts under the header, ending in "More". */
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
              <Text style={styles.label}>{label}</Text>
            </Pressable>
          ))}

      <Pressable
        onPress={onViewAll}
        accessibilityRole="button"
        accessibilityLabel="More categories"
        style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
      >
        <View style={styles.art}>
          <Ionicons name="grid-outline" size={22} color={colors.navy} />
        </View>
        <Text style={styles.label}>More</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  tile: {
    flex: 1,
    maxWidth: 76,
    alignItems: 'center',
    gap: 4,
  },
  pressed: {
    opacity: 0.8,
  },
  art: {
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radius.md,
    backgroundColor: '#F1F4F8',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  /** Slightly wider than narrow tiles so one-word labels like "Electrical" stay on one line. */
  label: {
    width: 46,
    fontSize: 9,
    lineHeight: 13,
    fontFamily: fonts.medium,
    color: colors.text,
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
