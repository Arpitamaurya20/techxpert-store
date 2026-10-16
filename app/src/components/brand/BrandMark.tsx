import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { BRAND, BRAND_LOGO, BRAND_LOGO_ASPECT_RATIO } from '@/constants/brand';
import { colors, fonts, spacing } from '@/constants/theme';

type BrandMarkSize = 'large' | 'medium' | 'small' | 'compact';

type BrandMarkProps = {
  /**
   * "large" for the login hero, "medium" for the hero on short screens, "small" for store headers,
   * "compact" for the one-row store header.
   * Place the logo on a light background; see `colors.logoBackdrop`.
   */
  size?: BrandMarkSize;
};

export function BrandMark({ size = 'large' }: BrandMarkProps) {
  const isSmall = size === 'small' || size === 'compact';

  if (BRAND_LOGO) {
    return (
      <Image
        source={BRAND_LOGO}
        style={logoStyles[size]}
        contentFit="contain"
        autoplay
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${BRAND.fullName} logo`}
      />
    );
  }

  return (
    <View
      style={isSmall ? styles.wordmarkSmall : styles.wordmark}
      accessible
      accessibilityRole="header"
      accessibilityLabel={BRAND.fullName}
    >
      <Text style={[styles.name, nameStyles[size]]}>{BRAND.name}</Text>
      <View style={[styles.regionRow, isSmall && styles.regionRowSmall]}>
        <View style={[styles.regionLine, isSmall && styles.regionLineSmall]} />
        <Text style={[styles.region, isSmall && styles.regionSmall]}>{BRAND.region}</Text>
        <View style={[styles.regionLine, isSmall && styles.regionLineSmall]} />
      </View>
    </View>
  );
}

const logoStyles = StyleSheet.create({
  large: { width: 260, height: Math.round(260 / BRAND_LOGO_ASPECT_RATIO) },
  medium: { width: 200, height: Math.round(200 / BRAND_LOGO_ASPECT_RATIO) },
  small: { width: 150, height: Math.round(150 / BRAND_LOGO_ASPECT_RATIO) },
  compact: { width: 100, height: Math.round(100 / BRAND_LOGO_ASPECT_RATIO) },
});

const nameStyles = StyleSheet.create({
  large: { fontSize: 34, lineHeight: 40, letterSpacing: 4, paddingLeft: 4 },
  medium: { fontSize: 28, lineHeight: 34, letterSpacing: 4, paddingLeft: 4 },
  small: { fontSize: 18, lineHeight: 22, letterSpacing: 2, paddingLeft: 2 },
  compact: { fontSize: 16, lineHeight: 20, letterSpacing: 2, paddingLeft: 2 },
});

const styles = StyleSheet.create({
  wordmark: {
    alignItems: 'center',
  },
  wordmarkSmall: {
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  name: {
    fontFamily: fonts.bold,
    color: colors.white,
  },
  regionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  regionRowSmall: {
    gap: spacing.xs,
    marginTop: 1,
  },
  regionLine: {
    width: 24,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.accent,
  },
  regionLineSmall: {
    width: 14,
  },
  region: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    letterSpacing: 6,
    paddingLeft: 6,
    color: colors.textOnDark,
  },
  regionSmall: {
    fontSize: 8,
    letterSpacing: 4,
    paddingLeft: 4,
  },
});
