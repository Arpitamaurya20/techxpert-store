import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { SUPPORT } from '@/constants/brand';
import { cardShadow, colors, fonts, radius, spacing } from '@/constants/theme';

type TrustItem = {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
};

export function TrustStrip() {
  const router = useRouter();

  const items: TrustItem[] = [
    {
      icon: 'truck-fast-outline',
      label: 'Fast\nDelivery',
      accessibilityLabel: 'Fast and reliable delivery. Set delivery location',
      onPress: () => router.push('/delivery-location'),
    },
    {
      icon: 'shield-check-outline',
      label: '100% Genuine\nProducts',
      accessibilityLabel: '100% genuine products. About us',
      onPress: () => router.push('/about/us'),
    },
    {
      icon: 'tag-outline',
      label: 'Bulk & Project\nPricing',
      accessibilityLabel: 'Bulk and project pricing. Contact us',
      onPress: () => router.push('/help'),
    },
    {
      icon: 'headset',
      label: 'Expert\nSupport',
      accessibilityLabel: `Expert support. Call ${SUPPORT.phoneLabel}`,
      onPress: () => Linking.openURL(`tel:${SUPPORT.phone}`).catch(() => router.push('/help')),
    },
  ];

  return (
    <View style={styles.strip}>
      {items.map((item) => (
        <Pressable
          key={item.label}
          onPress={item.onPress}
          accessibilityRole="button"
          accessibilityLabel={item.accessibilityLabel}
          style={({ pressed }) => [styles.item, pressed && styles.pressed]}
        >
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name={item.icon} size={20} color={colors.navy} />
          </View>
          <Text style={styles.label}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  item: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    paddingHorizontal: 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    ...cardShadow,
  },
  pressed: {
    backgroundColor: colors.navySoft,
  },
  iconCircle: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: colors.navySoft,
  },
  label: {
    fontSize: 10,
    lineHeight: 13,
    fontFamily: fonts.medium,
    color: colors.navy,
    textAlign: 'center',
  },
});
