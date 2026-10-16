import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { memo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, spacing } from '@/constants/theme';
import { getSubcategoryArt } from '@/data/subcategoryArt';
import type { Subcategory } from '@/types/catalog';
import { getCategoryIcon } from '@/utils/categoryIcon';

type SubcategoryTileProps = {
  subcategory: Subcategory;
  width: number;
  onPress: (subcategory: Subcategory) => void;
};

function SubcategoryTileComponent({ subcategory, width, onPress }: SubcategoryTileProps) {
  const [remoteFailed, setRemoteFailed] = useState(false);
  const localArt = getSubcategoryArt(subcategory.id);
  const remote = !!subcategory.imageUrl && !remoteFailed;

  return (
    <Pressable
      onPress={() => onPress(subcategory)}
      accessibilityRole="button"
      accessibilityLabel={subcategory.name}
      accessibilityHint="Shows matching products"
      style={({ pressed }) => [styles.wrap, { width }, pressed && styles.pressed]}
    >
      <View style={styles.tile}>
        {remote ? (
          <Image
            source={{ uri: subcategory.imageUrl }}
            style={styles.image}
            resizeMode="contain"
            onError={() => setRemoteFailed(true)}
          />
        ) : localArt ? (
          <Image source={localArt} style={styles.image} resizeMode="contain" />
        ) : (
          <MaterialCommunityIcons name={getCategoryIcon(subcategory.categoryId)} size={32} color={colors.accent} />
        )}
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {subcategory.name}
      </Text>
    </Pressable>
  );
}

export const SubcategoryTile = memo(SubcategoryTileComponent);

export function SubcategoryTileSkeleton({ width }: { width: number }) {
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
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.medium,
    color: colors.homeInk,
    textAlign: 'center',
    width: '100%',
    minHeight: 36,
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
