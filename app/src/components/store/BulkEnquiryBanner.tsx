import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, spacing } from '@/constants/theme';

const BAGS = require('../../../assets/images/bulk-bags.jpg');
const LAVENDER = '#E3DBF0';
const BANNER_HEIGHT = 200;

type BulkEnquiryBannerProps = {
  onContact: () => void;
};

/** Points project buyers to the store contacts; it makes no pricing promise. */
export function BulkEnquiryBanner({ onContact }: BulkEnquiryBannerProps) {
  return (
    <View style={styles.card}>
      <View style={styles.copy}>
        <Text style={styles.title} accessibilityRole="header">
          Bulk
        </Text>
        <Text style={styles.titleLine2} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          Requirement?
        </Text>
        <Text style={styles.subtitle}>Get a quote for project orders</Text>
        <Pressable
          onPress={onContact}
          accessibilityRole="button"
          accessibilityLabel="Contact us about a bulk requirement"
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>CONTACT US</Text>
        </Pressable>
      </View>
      <Image source={BAGS} style={styles.image} resizeMode="cover" accessible={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.xl,
    backgroundColor: LAVENDER,
    overflow: 'hidden',
    height: BANNER_HEIGHT,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
    alignItems: 'flex-start',
    paddingVertical: spacing.xl,
    paddingLeft: spacing.xl,
    paddingRight: spacing.sm,
  },
  title: {
    fontSize: 34,
    lineHeight: 38,
    fontFamily: fonts.bold,
    color: colors.homeInk,
  },
  titleLine2: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: fonts.bold,
    color: colors.homeInk,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.medium,
    color: colors.homeInk,
  },
  button: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.homeInk,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.5,
    fontFamily: fonts.bold,
    color: colors.white,
  },
  image: {
    width: 140,
    height: BANNER_HEIGHT,
  },
});
