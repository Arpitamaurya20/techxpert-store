import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, spacing } from '@/constants/theme';
import { HeaderFade } from '@/components/store/HeaderFade';
import { getHomeCategoryArt } from '@/data/homeCategoryArt';
import type { Category } from '@/types/catalog';
import { getCategoryIcon } from '@/utils/categoryIcon';

const HERO = require('../../../assets/images/home-hero-cream.jpg');
const ARCH_WIDTH = 92;
const ARCH_HEIGHT = 118;
const SCALLOP_SIZE = 18;

type StoreBannerProps = {
  categories: Category[];
  onExplore: () => void;
  onOpenCategory: (category: Category) => void;
};

export function StoreBanner({ categories, onExplore, onOpenCategory }: StoreBannerProps) {
  return (
    <View style={styles.block}>
      <Image source={HERO} style={styles.hero} resizeMode="cover" accessible={false} />
      <HeaderFade steps={10} stepHeight={2} falloff={3} style={styles.fade} />
      <Pressable
        onPress={onExplore}
        accessibilityRole="button"
        accessibilityLabel="Browse building materials"
        style={styles.titleHit}
      >
        <Text style={styles.kicker}>TECHXPERT STORE</Text>
        <Text style={styles.title}>Project{'\n'}essentials</Text>
       
      </Pressable>

      {categories.length > 0 ? (
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.archRow}
        >
          {categories.map((category) => (
            <ArchTile key={category.id} category={category} onPress={onOpenCategory} />
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.scallops} pointerEvents="none">
        {Array.from({ length: 24 }, (_, index) => (
          <View key={index} style={styles.scallop} />
        ))}
      </View>
    </View>
  );
}

function ArchTile({
  category,
  onPress,
}: {
  category: Category;
  onPress: (category: Category) => void;
}) {
  const [remoteFailed, setRemoteFailed] = useState(false);
  const localArt = getHomeCategoryArt(category.id);
  const remote = !!category.imageUrl && !remoteFailed;

  return (
    <Pressable
      onPress={() => onPress(category)}
      accessibilityRole="button"
      accessibilityLabel={`${category.name} category`}
      style={({ pressed }) => [styles.archItem, pressed && styles.pressed]}
    >
      <View style={styles.arch}>
        {remote ? (
          <Image
            source={{ uri: category.imageUrl }}
            style={styles.archImage}
            resizeMode="contain"
            onError={() => setRemoteFailed(true)}
          />
        ) : localArt ? (
          <Image source={localArt} style={styles.archImage} resizeMode="contain" />
        ) : (
          <MaterialCommunityIcons
            name={getCategoryIcon(category.id, category.icon)}
            size={36}
            color={colors.accent}
          />
        )}
      </View>
      <Text style={styles.archLabel} numberOfLines={2}>
        {category.name.split('&')[0].trim()}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.homeCream,
    paddingBottom: spacing.sm,
    overflow: 'hidden',
  },
  hero: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  fade: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
  },
  titleHit: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    gap: 4,
  },
  kicker: {
    fontSize: 10,
    letterSpacing: 2,
    fontFamily: fonts.semiBold,
    color: colors.homeInkMuted,
  },
  title: {
    fontSize: 24,
    lineHeight: 28,
    fontFamily: fonts.bold,
    color: colors.homeInk,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.regular,
    color: colors.homeInkMuted,
    textAlign: 'center',
  },
  archRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  archItem: {
    width: ARCH_WIDTH,
    alignItems: 'center',
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.85,
  },
  arch: {
    width: ARCH_WIDTH,
    height: ARCH_HEIGHT,
    borderTopLeftRadius: ARCH_WIDTH / 2,
    borderTopRightRadius: ARCH_WIDTH / 2,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    borderWidth: 2,
    borderColor: colors.homeArch,
    backgroundColor: colors.white,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  archImage: {
    width: '100%',
    height: '100%',
  },
  archLabel: {
    fontSize: 13,
    lineHeight: 16,
    fontFamily: fonts.medium,
    color: colors.homeInkMuted,
    textAlign: 'center',
  },
  scallops: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: -SCALLOP_SIZE / 2,
  },
  scallop: {
    width: SCALLOP_SIZE,
    height: SCALLOP_SIZE,
    borderRadius: SCALLOP_SIZE / 2,
    backgroundColor: colors.white,
    marginHorizontal: -1,
  },
});
