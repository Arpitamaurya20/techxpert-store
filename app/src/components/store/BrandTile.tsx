import { memo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, spacing, typography } from '@/constants/theme';
import type { Brand } from '@/types/catalog';

const MAX_WORDMARK_SIZE = 14;
const MIN_WORDMARK_SIZE = 8;
const TILE_PADDING = spacing.sm;
/** Rough Poppins Bold glyph width as a share of font size. */
const GLYPH_WIDTH_RATIO = 0.66;

/** Picks a size so the longest word fits on one line (auto-shrink is not available on web). */
function wordmarkSize(name: string, tileWidth: number) {
  const longestWord = Math.max(...name.split(/\s+/).map((word) => word.length));
  const innerWidth = tileWidth - TILE_PADDING * 2 - 2;
  const fitted = Math.floor(innerWidth / (longestWord * GLYPH_WIDTH_RATIO));
  return Math.max(MIN_WORDMARK_SIZE, Math.min(MAX_WORDMARK_SIZE, fitted));
}

type BrandTileProps = {
  brand: Brand;
  width: number;
  onPress: (brand: Brand) => void;
};

/** Square brand tile for the Categories grid: logo from the API, otherwise the brand name as a wordmark. */
function BrandTileComponent({ brand, width, onPress }: BrandTileProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const showLogo = !!brand.logoUrl && !logoFailed;
  const fontSize = wordmarkSize(brand.name, width);

  return (
    <Pressable
      onPress={() => onPress(brand)}
      accessibilityRole="button"
      accessibilityLabel={`${brand.name} products`}
      style={({ pressed }) => [styles.wrap, { width }, pressed && styles.pressed]}
    >
      <View style={styles.tile}>
        {showLogo ? (
          <Image
            source={{ uri: brand.logoUrl }}
            style={styles.logo}
            resizeMode="contain"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <Text
            style={[styles.wordmark, { fontSize, lineHeight: Math.round(fontSize * 1.3) }]}
            numberOfLines={3}
          >
            {brand.name}
          </Text>
        )}
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {brand.name}
      </Text>
    </Pressable>
  );
}

export const BrandTile = memo(BrandTileComponent);

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
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: TILE_PADDING,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  wordmark: {
    fontFamily: fonts.bold,
    color: colors.homeInk,
    textAlign: 'center',
  },
  name: {
    ...typography.small,
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 16,
    color: colors.homeInk,
    textAlign: 'center',
    width: '100%',
    minHeight: 32,
  },
});
