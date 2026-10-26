import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { SUPPORT } from '@/constants/brand';
import { cardShadow, colors, fonts, radius, spacing } from '@/constants/theme';
import type { TrustClaim } from '@/services/cmsApi';

type TrustItem = {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
};

type TrustStripProps = {
  /** Published claims. Leave this out to use the app's own four. An empty list draws nothing. */
  published?: TrustClaim[];
  phone?: string;
  phoneLabel?: string;
};

export function TrustStrip({ published, phone, phoneLabel }: TrustStripProps) {
  const router = useRouter();

  if (published && published.length === 0) return null;

  const open = (action: TrustClaim['action']) => {
    if (action === 'delivery') router.push('/delivery-location');
    else if (action === 'about') router.push('/about/us');
    else if (action === 'phone' && phone) {
      Linking.openURL(`tel:${phone}`).catch(() => router.push('/help'));
    } else router.push('/help');
  };

  const items: TrustItem[] = published
    ? published.map((claim) => ({
        icon: claim.icon,
        label: claim.label,
        accessibilityLabel: claim.action === 'phone' && phoneLabel ? `${claim.label}. Call ${phoneLabel}` : claim.label,
        onPress: () => open(claim.action),
      }))
    : [
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
