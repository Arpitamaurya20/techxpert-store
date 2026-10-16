import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand/BrandMark';
import { BRAND } from '@/constants/brand';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

type AuthHeroProps = {
  compact?: boolean;
};

export function AuthHero({ compact = false }: AuthHeroProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.hero,
        {
          paddingTop: insets.top + (compact ? spacing.xl : spacing.xxxl),
          paddingBottom: (compact ? spacing.xl : spacing.xxxl) + radius.xl,
        },
      ]}
    >
      <View style={[styles.circle, styles.circleLarge]} />
      <View style={[styles.circle, styles.circleSmall]} />

      <BrandMark size={compact ? 'medium' : 'large'} />
      <Text style={styles.tagline}>{BRAND.tagline}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.logoBackdrop,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    overflow: 'hidden',
  },
  circle: {
    position: 'absolute',
    borderRadius: radius.pill,
    pointerEvents: 'none',
  },
  circleLarge: {
    width: 260,
    height: 260,
    top: -120,
    right: -80,
    backgroundColor: colors.logoBackdropDeep,
  },
  circleSmall: {
    width: 140,
    height: 140,
    bottom: -20,
    left: -60,
    backgroundColor: colors.logoRed,
    opacity: 0.08,
  },
  tagline: {
    ...typography.caption,
    fontFamily: fonts.medium,
    color: colors.text,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
