import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand/BrandMark';
import { GLASS_EDGE, GlassBackground, glassSurface } from '@/components/ui/GlassBackground';
import { MAX_STORE_WIDTH, SCREEN_PADDING, colors, fonts, radius, spacing } from '@/constants/theme';
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
      <Ionicons name={icon} size={21} color={colors.navy} />
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
 * Compact store header: logo, delivery location, cart, profile and search.
 * Screens pin it with `stickyHeaderIndices={[0]}` so search stays one tap away.
 * By default the search opens product results; pass `search` to drive it from the screen instead.
 */
export function StoreHeader({ search: screenSearch }: { search?: HeaderSearch } = {}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cartCount = useCartCount();
  const location = useDeliveryLocation();
  const [searchText, setSearchText] = useState('');
  const locationText = location
    ? [location.city, location.pincode].filter(Boolean).join(', ')
    : 'Select your delivery location';

  const search = (query: string) => {
    addRecentSearch(query);
    router.push({ pathname: '/products', params: { search: query } });
  };

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <GlassBackground />
      <View style={styles.inner}>
        <View style={styles.topRow}>
          <View style={styles.brand}>
            <BrandMark size="small" />
            
          </View>

          <HeaderAction
            icon="cart-outline"
            accessibilityLabel="Cart"
            badgeCount={cartCount}
            onPress={() => router.navigate('/cart')}
          />
          <HeaderAction icon="person-outline" accessibilityLabel="Profile" onPress={() => router.navigate('/profile')} />
        </View>

        <Pressable
          onPress={() => router.push('/delivery-location')}
          accessibilityRole="button"
          accessibilityLabel={`Deliver to ${location ? locationText : 'location not set'}. Change location`}
          style={({ pressed }) => [styles.location, pressed && styles.actionPressed]}
        >
          <Ionicons name="location-outline" size={20} color={colors.navy} />
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

        {screenSearch ? (
          <ProductSearchBar {...screenSearch} />
        ) : (
          <ProductSearchBar
            value={searchText}
            onChangeText={setSearchText}
            onSubmit={search}
            placeholder="Search cement, tiles, paints, plumbing..."
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
    ...glassSurface,
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
    marginTop: -2,
    fontSize: 10,
    lineHeight: 13,
    fontFamily: fonts.medium,
    color: colors.logoBlue,
  },
  location: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 2,
    paddingRight: spacing.sm,
    borderRadius: radius.sm,
  },
  locationText: {
    flexShrink: 1,
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
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1,
    borderColor: GLASS_EDGE,
  },
  actionPressed: {
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
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
