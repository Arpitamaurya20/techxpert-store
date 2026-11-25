import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, spacing } from '@/constants/theme';
import { resolveHomeCategoryArt } from '@/data/homeCategoryArt';
import { CATEGORY_SHORTCUTS } from '@/data/homeContent';
import type { Category } from '@/types/catalog';

/** Seven category tiles + More — soft blue 4×2 grid like the home mock. */
const SHORTCUT_SLOTS = 7;
const TILE_RADIUS = 18;
const TILE_BG = '#E8EEF6';
const TILE_BG_MORE = '#E4ECF8';

type CategoryShortcutsProps = {
  categories: Category[];
  loading: boolean;
  published?: { categoryId: string; label: string; name: string; imageUrl: string }[];
  onOpenCategory: (category: Category) => void;
  onViewAll: () => void;
};

/**
 * Soft blue squircle with a padded image inside (mock style), not a full-bleed photo.
 */
function ShortcutArt({ category }: { category: Category }) {
  const [remoteFailed, setRemoteFailed] = useState(false);
  const localArt = resolveHomeCategoryArt(category.id, category.name);
  const showRemote = Boolean(category.imageUrl) && !remoteFailed;

  return (
    <View style={styles.artInner}>
      {showRemote && category.imageUrl ? (
        <Image
          source={{ uri: category.imageUrl }}
          style={styles.image}
          contentFit="contain"
          transition={120}
          onError={() => setRemoteFailed(true)}
        />
      ) : (
        <Image source={localArt} style={styles.image} contentFit="contain" />
      )}
    </View>
  );
}

function shortLabel(name: string) {
  return name.split(/[&/]/)[0]?.trim() || name;
}

type ShortcutTile = { category: Category; label: string };

function toCatalogueTiles(list: Category[], limit: number): ShortcutTile[] {
  return list.slice(0, limit).map((category) => ({
    category,
    label: shortLabel(category.name),
  }));
}

/** Fill up to `limit` tiles; keep order, skip ids already used. */
function padWithCatalogue(base: ShortcutTile[], catalogue: Category[], limit: number): ShortcutTile[] {
  if (base.length >= limit) return base.slice(0, limit);
  const used = new Set(base.map((tile) => tile.category.id));
  const extras = catalogue
    .filter((category) => !used.has(category.id))
    .slice(0, limit - base.length)
    .map((category) => ({ category, label: shortLabel(category.name) }));
  return [...base, ...extras];
}

/** Home mock category strip: up to 7 soft-blue image tiles + More. */
export function CategoryShortcuts({ categories, loading, published, onOpenCategory, onViewAll }: CategoryShortcutsProps) {
  const findCategory = (id: string) =>
    categories.find((item) => item.id === id || item.id === String(id));

  const fromPublished =
    published?.flatMap((shortcut) => {
      const known = findCategory(String(shortcut.categoryId));
      if (!known) return [];
      const category: Category = {
        ...known,
        name: shortcut.name || known.name,
        imageUrl: shortcut.imageUrl || known.imageUrl,
      };
      return [{ category, label: shortcut.label || shortLabel(category.name) }] as ShortcutTile[];
    }) ?? [];

  const fromDefaults = CATEGORY_SHORTCUTS.flatMap(({ categoryId, label }) => {
    const category = findCategory(categoryId);
    return category ? [{ category, label }] : [];
  });

  // CMS shortcuts often match only 1 live id — always pad from GET /catalog/categories
  // so the home grid shows up to 7 tiles (API had 12; UI was stuck on EV + More).
  const shortcuts = (
    fromPublished.length > 0
      ? padWithCatalogue(fromPublished, categories, SHORTCUT_SLOTS)
      : fromDefaults.length > 0
        ? padWithCatalogue(fromDefaults, categories, SHORTCUT_SLOTS)
        : toCatalogueTiles(categories, SHORTCUT_SLOTS)
  );

  const showTiles = shortcuts.length > 0;
  const showSkeleton = loading && !showTiles;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {showSkeleton
          ? Array.from({ length: SHORTCUT_SLOTS }, (_, i) => (
              <View key={`sk-${i}`} style={styles.tile} accessibilityElementsHidden importantForAccessibility="no">
                <View style={[styles.art, styles.skeletonArt]} />
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
            <Ionicons name="grid" size={28} color={colors.navy} />
          </View>
          <Text style={styles.label}>More</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.md,
  },
  tile: {
    width: '23%',
    alignItems: 'center',
    gap: 8,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  art: {
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: TILE_RADIUS,
    backgroundColor: TILE_BG,
  },
  artInner: {
    width: '72%',
    height: '72%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreArt: {
    backgroundColor: TILE_BG_MORE,
  },
  skeletonArt: {
    backgroundColor: TILE_BG,
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
    width: '55%',
    height: 10,
    marginTop: 2,
    borderRadius: 5,
    backgroundColor: '#D8E0EC',
  },
});
