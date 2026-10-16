import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { colors, fonts, spacing } from '@/constants/theme';
import type { MaterialIconName } from '@/utils/categoryIcon';

export const CATEGORY_RAIL_WIDTH = 88;
const THUMB_SIZE = 56;

export type CategoryRailItem = {
  id: string;
  label: string;
  imageUrl?: string;
  localArt?: ImageSourcePropType;
  fallbackIcon: MaterialIconName;
};

type CategoryRailProps = {
  items: CategoryRailItem[];
  selectedId: string;
  onSelect: (id: string) => void;
};

/** Vertical list of product types on the left of a category page. */
export function CategoryRail({ items, selectedId, onSelect }: CategoryRailProps) {
  return (
    <ScrollView
      style={styles.rail}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      accessibilityRole="tablist"
    >
      {items.map((item) => (
        <RailButton key={item.id} item={item} selected={item.id === selectedId} onSelect={onSelect} />
      ))}
    </ScrollView>
  );
}

function RailButton({
  item,
  selected,
  onSelect,
}: {
  item: CategoryRailItem;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const [remoteFailed, setRemoteFailed] = useState(false);
  const remote = !!item.imageUrl && !remoteFailed;

  return (
    <Pressable
      onPress={() => onSelect(item.id)}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={item.label}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}
    >
      <View style={[styles.thumb, selected && styles.thumbSelected]}>
        {remote ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.image}
            resizeMode="contain"
            onError={() => setRemoteFailed(true)}
          />
        ) : item.localArt ? (
          <Image source={item.localArt} style={styles.image} resizeMode="contain" />
        ) : (
          <MaterialCommunityIcons name={item.fallbackIcon} size={26} color={colors.accent} />
        )}
      </View>
      <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={2}>
        {item.label}
      </Text>
      {selected ? <View style={styles.indicator} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: CATEGORY_RAIL_WIDTH,
    flexGrow: 0,
    borderRightWidth: 1,
    borderRightColor: colors.cardBorder,
    backgroundColor: colors.background,
  },
  content: {
    paddingVertical: spacing.sm,
  },
  item: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  pressed: {
    opacity: 0.8,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#F5F6F8',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 6,
  },
  thumbSelected: {
    backgroundColor: colors.accentSoft,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    textAlign: 'center',
  },
  labelSelected: {
    fontFamily: fonts.semiBold,
    color: colors.homeInk,
  },
  indicator: {
    position: 'absolute',
    top: spacing.sm,
    bottom: spacing.sm,
    right: 0,
    width: 4,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    backgroundColor: colors.accent,
  },
});
