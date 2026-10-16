import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { SUPPORT } from '@/constants/brand';
import { colors, fonts, radius, spacing } from '@/constants/theme';

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
      label: 'Fast & Reliable\nDelivery',
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
          <MaterialCommunityIcons name={item.icon} size={18} color={colors.navy} />
          <Text style={styles.label}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: 4,
    borderRadius: radius.md,
    backgroundColor: colors.navySoft,
  },
  item: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 1,
    borderRadius: radius.sm,
  },
  pressed: {
    backgroundColor: colors.logoBackdropDeep,
  },
  label: {
    flexShrink: 1,
    fontSize: 8.5,
    lineHeight: 11,
    fontFamily: fonts.medium,
    color: colors.navy,
  },
});
