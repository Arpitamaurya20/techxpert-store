import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { cardShadow, colors, fonts, radius, spacing } from '@/constants/theme';
import { useWishlistCount } from '@/state/wishlistStore';

import { SectionHeader } from './SectionHeader';

type ToolCardProps = {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
  onPress: () => void;
};

function ToolCard({ icon, title, subtitle, onPress }: ToolCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.icon}>
        <Ionicons name={icon} size={22} color={colors.navy} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

/** Material Calculator and Saved Items — the portal "Quick tools" Home block. */
export function QuickTools({ title = 'Quick tools' }: { title?: string }) {
  const router = useRouter();
  const savedCount = useWishlistCount();

  return (
    <View style={styles.section}>
      <SectionHeader title={title} />
      <View style={styles.list}>
        <ToolCard
          icon="calculator-outline"
          title="Material Calculator"
          subtitle="Estimate cement, paint and tiles for your job"
          onPress={() => router.push('/calculator')}
        />
        <ToolCard
          icon="heart-outline"
          title="Saved Items"
          subtitle={
            savedCount > 0
              ? `${savedCount} saved ${savedCount === 1 ? 'product' : 'products'}`
              : 'Tap the heart on products to save them here'
          }
          onPress={() => router.push('/wishlist')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  list: {
    gap: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    ...cardShadow,
  },
  pressed: {
    backgroundColor: colors.navySoft,
  },
  icon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: colors.navySoft,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontSize: 15,
    lineHeight: 21,
    fontFamily: fonts.semiBold,
    color: colors.navy,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
});
