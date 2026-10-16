import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconButton } from '@/components/ui/IconButton';
import { MAX_STORE_WIDTH, SCREEN_PADDING, colors, fonts, radius, spacing, typography } from '@/constants/theme';
import { useCartCount } from '@/state/cartStore';
import { useDeliveryLocation } from '@/state/locationStore';

type StoreHeaderProps = {
  children?: ReactNode;
  /** Reports the search bar's distance from the top of the header (see `usePinnedSearch`). */
  onSearchLayout?: (offset: number) => void;
};

export function StoreHeader({ children, onSearchLayout }: StoreHeaderProps) {
  const router = useRouter();
  const cartCount = useCartCount();
  const location = useDeliveryLocation();
  const locationText = location ? `${location.city} ${location.pincode}` : 'Select delivery location';

  return (
    <View style={styles.header}>
      <View style={styles.inner}>
        <View style={styles.titleRow}>
          <View style={styles.titles}>
            <Text style={styles.headline} accessibilityRole="header">
              {location ? `Delivering to${'\n'}${location.city}` : `Shop materials${'\n'}& supplies`}
            </Text>
            <Pressable
              onPress={() => router.push('/delivery-location')}
              accessibilityRole="button"
              accessibilityLabel={`Delivery location: ${locationText}. Change location`}
              style={({ pressed }) => [styles.location, pressed && styles.locationPressed]}
            >
              <Text style={styles.locationValue} numberOfLines={1}>
                {locationText}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.homeInk} />
            </Pressable>
          </View>

          <View style={styles.actions}>
            <IconButton
              icon="gift-outline"
              accessibilityLabel="Cart"
              badgeCount={cartCount}
              surface="filled"
              onPress={() => router.navigate('/cart')}
            />
            <IconButton
              icon="person-outline"
              accessibilityLabel="Profile"
              surface="filled"
              onPress={() => router.navigate('/profile')}
            />
          </View>
        </View>

        {children ? (
          <View style={styles.search} onLayout={(event) => onSearchLayout?.(event.nativeEvent.layout.y)}>
            {children}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.homePink,
    paddingBottom: spacing.md,
    paddingHorizontal: SCREEN_PADDING,
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: MAX_STORE_WIDTH - SCREEN_PADDING * 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  titles: {
    flex: 1,
  },
  headline: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: fonts.bold,
    color: colors.homeInk,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minHeight: 28,
    gap: spacing.xs,
    marginTop: 2,
    paddingRight: spacing.sm,
    borderRadius: radius.sm,
  },
  locationPressed: {
    opacity: 0.7,
  },
  locationValue: {
    ...typography.caption,
    flexShrink: 1,
    fontFamily: fonts.medium,
    color: colors.homeInk,
  },
  search: {
    marginTop: spacing.md,
  },
});
