import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand/BrandMark';
import { BRAND } from '@/constants/brand';
import { MAX_STORE_WIDTH, SCREEN_PADDING, colors, fonts, spacing } from '@/constants/theme';
import { useCartCount } from '@/state/cartStore';
import { useDeliveryLocation } from '@/state/locationStore';
import { addRecentSearch } from '@/state/searchHistoryStore';

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
      hitSlop={4}
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
    >
      <Ionicons name={icon} size={22} color={colors.navy} />
      {badgeCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

type HeaderSearch = {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: (query: string) => void;
  placeholder: string;
  accessibilityLabel: string;
};

/**
 * Home-style store header matching the Techxpert mock: logo, circular cart/profile,
 * inline deliver-to, and search with voice.
 */
export function StoreHeader({ search: screenSearch }: { search?: HeaderSearch } = {}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cartCount = useCartCount();
  const location = useDeliveryLocation();
  const [searchText, setSearchText] = useState('');
  const locationText = location
    ? [location.city, location.pincode].filter(Boolean).join(', ')
    : 'Select location';

  const search = (query: string) => {
    addRecentSearch(query);
    router.push({ pathname: '/products', params: { search: query } });
  };

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.inner}>
        <View style={styles.topRow}>
          <View style={styles.brand}>
            <BrandMark size="small" />
            <Text style={styles.tagline}>{BRAND.tagline}</Text>
          </View>

          <View style={styles.actions}>
            <HeaderAction
              icon="cart-outline"
              accessibilityLabel="Cart"
              badgeCount={cartCount}
              onPress={() => router.navigate('/cart')}
            />
            <HeaderAction
              icon="person-outline"
              accessibilityLabel="Profile"
              onPress={() => router.navigate('/profile')}
            />
          </View>
        </View>

        <Pressable
          onPress={() => router.push('/delivery-location')}
          accessibilityRole="button"
          accessibilityLabel={`Deliver to ${location ? locationText : 'location not set'}. Change location`}
          style={({ pressed }) => [styles.location, pressed && styles.locationPressed]}
        >
          <Ionicons name="location-sharp" size={18} color={colors.navy} />
          <Text style={styles.locationLead}>Deliver to </Text>
          <Text style={styles.locationValue} numberOfLines={1}>
            {locationText}
          </Text>
          <Ionicons name="chevron-down" size={14} color={colors.navy} />
        </Pressable>

        {screenSearch ? (
          <ProductSearchBar {...screenSearch} shape="pill" />
        ) : (
          <ProductSearchBar
            value={searchText}
            onChangeText={setSearchText}
            onSubmit={search}
            placeholder="Search cement, tiles, paints, plumb..."
            shape="pill"
            voice
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  inner: {
    width: '100%',
    maxWidth: MAX_STORE_WIDTH - SCREEN_PADDING * 2,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brand: {
    flex: 1,
    alignItems: 'flex-start',
  },
  tagline: {
    marginTop: 1,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.medium,
    color: colors.navy,
    opacity: 0.72,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  location: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 2,
    paddingRight: spacing.sm,
  },
  locationPressed: {
    opacity: 0.75,
  },
  locationLead: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.regular,
    color: colors.navy,
  },
  locationValue: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.semiBold,
    color: colors.navy,
    textTransform: 'lowercase',
  },
  action: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  actionPressed: {
    backgroundColor: colors.navySoft,
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.logoRed,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 14,
    fontFamily: fonts.semiBold,
    color: colors.white,
  },
});
