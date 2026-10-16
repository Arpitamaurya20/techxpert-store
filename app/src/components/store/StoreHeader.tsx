import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand/BrandMark';
import { MAX_STORE_WIDTH, MIN_TOUCH_TARGET, SCREEN_PADDING, colors, fonts, radius, spacing } from '@/constants/theme';
import { useCartCount } from '@/state/cartStore';
import { useDeliveryLocation } from '@/state/locationStore';

import { ProductSearchBar } from './ProductSearchBar';

type HeaderActionProps = {
  icon: ComponentProps<typeof Ionicons>['name'];
  accessibilityLabel: string;
  onPress: () => void;
  badgeCount?: number;
};

function HeaderAction({ icon, accessibilityLabel, onPress, badgeCount = 0 }: HeaderActionProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badgeCount > 0 ? `${accessibilityLabel}, ${badgeCount} items` : accessibilityLabel}
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
    >
      <Ionicons name={icon} size={24} color={colors.navy} />
      {badgeCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * Compact store header: logo, delivery location, cart, profile and search.
 * Screens pin it with `stickyHeaderIndices={[0]}` so search stays one tap away.
 */
export function StoreHeader() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cartCount = useCartCount();
  const location = useDeliveryLocation();
  const [searchText, setSearchText] = useState('');
  const locationText = location ? location.pincode : 'Select';

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.inner}>
        <View style={styles.topRow}>
          <View style={styles.brand}>
            <BrandMark size="compact" />
            <Text style={styles.tagline} numberOfLines={1}>
              Shop Materials & Supplies
            </Text>
          </View>

          <Pressable
            onPress={() => router.push('/delivery-location')}
            accessibilityRole="button"
            accessibilityLabel={`Deliver to ${location ? `${location.city} ${location.pincode}` : 'location not set'}. Change location`}
            style={({ pressed }) => [styles.location, pressed && styles.actionPressed]}
          >
            <Ionicons name="location-sharp" size={22} color={colors.navy} />
            <View style={styles.locationText}>
              <Text style={styles.locationLabel}>Deliver to</Text>
              <View style={styles.locationValueRow}>
                <Text style={styles.locationValue} numberOfLines={1}>
                  {locationText}
                </Text>
                <Ionicons name="chevron-down" size={14} color={colors.navy} />
              </View>
            </View>
          </Pressable>

          <HeaderAction
            icon="cart"
            accessibilityLabel="Cart"
            badgeCount={cartCount}
            onPress={() => router.navigate('/cart')}
          />
          <Pressable
            onPress={() => router.navigate('/profile')}
            accessibilityRole="button"
            accessibilityLabel="Profile"
            style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
          >
            <View style={styles.profileCircle}>
              <Ionicons name="person-outline" size={18} color={colors.navy} />
            </View>
          </Pressable>
        </View>

        <ProductSearchBar
          value={searchText}
          onChangeText={setSearchText}
          onSubmit={(search) => router.push({ pathname: '/products', params: { search } })}
          placeholder="Search cement, tiles, paints, plumbing..."
          voice
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    ...Platform.select({
      web: { boxShadow: '0px 2px 8px rgba(11, 42, 91, 0.06)' },
      default: {
        shadowColor: colors.navy,
        shadowOpacity: 0.06,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      },
    }),
  },
  inner: {
    width: '100%',
    maxWidth: MAX_STORE_WIDTH - SCREEN_PADDING * 2,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  brand: {
    alignItems: 'flex-start',
  },
  tagline: {
    marginTop: -2,
    fontSize: 9,
    lineHeight: 12,
    fontFamily: fonts.medium,
    color: colors.logoBlue,
  },
  location: {
    flex: 1,
    minWidth: 0,
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginLeft: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
  },
  profileCircle: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.navy,
  },
  locationText: {
    flex: 1,
    minWidth: 0,
  },
  locationLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  locationValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  locationValue: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 19,
    fontFamily: fonts.semiBold,
    color: colors.navy,
  },
  action: {
    width: 40,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  actionPressed: {
    backgroundColor: colors.navySoft,
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.orange,
    borderWidth: 1.5,
    borderColor: colors.card,
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 14,
    fontFamily: fonts.semiBold,
    color: colors.white,
  },
});
