import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, spacing } from '@/constants/theme';

const ARTWORK = require('../../../assets/images/diwali-banner.jpg');
/** Deep festive gold that stays readable on the cream side of the artwork. */
const DIWALI_GOLD = '#9C6414';
const BANNER_HEIGHT = 190;

type DiwaliOfferBannerProps = {
  onShop: () => void;
};

/** Seasonal Diwali banner; it promises no discount, so no pricing data is needed. */
export function DiwaliOfferBanner({ onShop }: DiwaliOfferBannerProps) {
  return (
    <View style={styles.card}>
      <Image source={ARTWORK} style={styles.artwork} resizeMode="cover" accessible={false} />
      <View style={styles.copy}>
        <Text style={styles.title} accessibilityRole="header">
          Diwali
        </Text>
        <Text style={styles.titleLine2}>Special</Text>
        <Text style={styles.subtitle}>on Building Essentials</Text>
        <Pressable
          onPress={onShop}
          accessibilityRole="button"
          accessibilityLabel="Shop now for Diwali"
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>Shop Now</Text>
          <Ionicons name="arrow-forward" size={14} color={colors.white} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: BANNER_HEIGHT,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.homeCream,
    borderWidth: 1,
    borderColor: colors.homeArch,
  },
  artwork: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: '100%',
    height: BANNER_HEIGHT,
  },
  copy: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.xl,
    maxWidth: '62%',
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontFamily: fonts.bold,
    color: DIWALI_GOLD,
  },
  titleLine2: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: fonts.bold,
    color: colors.homeInk,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.medium,
    color: colors.homeInk,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.homeInk,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.bold,
    color: colors.white,
  },
});
