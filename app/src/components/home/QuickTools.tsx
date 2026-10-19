import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, spacing } from '@/constants/theme';
import { useWishlistCount } from '@/state/wishlistStore';

type ToolCardProps = {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
  tone: 'navy' | 'light';
  onPress: () => void;
};

function ToolCard({ icon, title, subtitle, tone, onPress }: ToolCardProps) {
  const dark = tone === 'navy';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      style={({ pressed }) => [styles.card, dark ? styles.cardNavy : styles.cardLight, pressed && styles.pressed]}
    >
      <View style={[styles.icon, dark ? styles.iconNavy : styles.iconLight]}>
        <Ionicons name={icon} size={20} color={dark ? colors.white : colors.accent} />
      </View>
      <Text style={[styles.title, dark && styles.titleNavy]}>{title}</Text>
      <Text style={[styles.subtitle, dark && styles.subtitleNavy]} numberOfLines={2}>
        {subtitle}
      </Text>
      <View style={styles.go}>
        <Ionicons name="arrow-forward" size={16} color={dark ? colors.white : colors.navy} />
      </View>
    </Pressable>
  );
}

/** Material Calculator and Saved Items shortcuts. */
export function QuickTools() {
  const router = useRouter();
  const savedCount = useWishlistCount();

  return (
    <View style={styles.row}>
      <ToolCard
        icon="calculator-outline"
        title="Material Calculator"
        subtitle="Estimate cement, paint & tiles"
        tone="navy"
        onPress={() => router.push('/calculator')}
      />
      <ToolCard
        icon="heart-outline"
        title="Saved Items"
        subtitle={savedCount > 0 ? `${savedCount} saved ${savedCount === 1 ? 'product' : 'products'}` : 'Tap ♡ on products to save'}
        tone="light"
        onPress={() => router.push('/wishlist')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  card: {
    flex: 1,
    minHeight: 128,
    gap: 4,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  cardNavy: {
    backgroundColor: colors.navy,
  },
  cardLight: {
    borderWidth: 1,
    borderColor: '#FAD9C6',
    backgroundColor: colors.accentSoft,
  },
  pressed: {
    opacity: 0.88,
  },
  icon: {
    width: 36,
    height: 36,
    marginBottom: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  iconNavy: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  iconLight: {
    backgroundColor: colors.card,
  },
  title: {
    fontSize: 14,
    lineHeight: 19,
    fontFamily: fonts.bold,
    color: colors.navy,
  },
  titleNavy: {
    color: colors.white,
  },
  subtitle: {
    paddingRight: spacing.lg,
    fontSize: 11,
    lineHeight: 15,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  subtitleNavy: {
    color: colors.textOnDark,
  },
  go: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
  },
});
