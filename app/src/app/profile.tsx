import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { useRouter, type Href } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { GLASS_HEADER_HEIGHT_ESTIMATE, GlassScreenHeader } from '@/components/ui/GlassScreenHeader';
import { useToast } from '@/components/ui/Toast';
import { BRAND } from '@/constants/brand';
import { CURRENT_LANGUAGE } from '@/constants/languages';
import { MAX_CONTENT_WIDTH, SCREEN_PADDING, cardShadow, colors, fonts, radius, spacing } from '@/constants/theme';
import { useStatusBarStyle } from '@/hooks/useStatusBarStyle';
import { useDeliveryLocation } from '@/state/locationStore';
import { clearSession, useSession } from '@/state/sessionStore';
import { useWishlistCount } from '@/state/wishlistStore';

const APP_VERSION = Constants.expoConfig?.version;
const SHARE_MESSAGE = `I shop construction materials and hardware on the ${BRAND.fullName} app.`;

type MenuItem = {
  key: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  value?: string;
  showChevron?: boolean;
  onPress: () => void;
};

export default function ProfileScreen() {
  useStatusBarStyle('dark');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(insets.top + GLASS_HEADER_HEIGHT_ESTIMATE);
  const { showToast } = useToast();
  const session = useSession();
  const location = useDeliveryLocation();
  const wishlistCount = useWishlistCount();
  const user = session?.user;

  const signOut = () => {
    clearSession();
    showToast({ message: 'You have signed out.', bottomOffset: spacing.lg });
  };

  const shareApp = async () => {
    try {
      await Share.share({ message: SHARE_MESSAGE, title: BRAND.fullName });
    } catch {
      showToast({
        variant: 'error',
        message: "Sharing isn't available on this device.",
        bottomOffset: spacing.lg,
      });
    }
  };

  const open = (href: Href) => () => router.push(href);

  const menu: MenuItem[] = [
    { key: 'orders', icon: 'receipt-outline', label: 'My Orders', showChevron: true, onPress: open('/orders') },
    {
      key: 'location',
      icon: 'location',
      label: 'Saved Addresses',
      value: location ? `${location.city} ${location.pincode}` : 'Not set',
      showChevron: true,
      onPress: open('/delivery-location'),
    },
    {
      key: 'saved',
      icon: 'heart-outline',
      label: 'Saved Items',
      value: wishlistCount > 0 ? `${wishlistCount} saved` : undefined,
      showChevron: true,
      onPress: open('/wishlist'),
    },
    { key: 'help', icon: 'help-circle-outline', label: 'Help & Support', showChevron: true, onPress: open('/help') },
    { key: 'share', icon: 'share-outline', label: 'Share App', onPress: shareApp },
    {
      key: 'about',
      icon: 'information-circle-outline',
      label: `About ${BRAND.fullName}`,
      showChevron: true,
      onPress: open('/about'),
    },
    {
      key: 'language',
      icon: 'language-outline',
      label: 'Language',
      value: CURRENT_LANGUAGE.label,
      showChevron: true,
      onPress: open('/language'),
    },
  ];

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + spacing.md, paddingBottom: insets.bottom + spacing.xl },
        ]}
        scrollIndicatorInsets={{ top: headerHeight }}
      >
        <View style={styles.inner}>
          <View style={styles.card}>
            <View style={styles.accountRow}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={40} color={colors.white} />
              </View>
              <View style={styles.accountText}>
                {user ? (
                  <>
                    <Text style={styles.name} numberOfLines={1} accessibilityRole="header">
                      {user.name ?? 'Techxpert customer'}
                    </Text>
                    {user.email || user.mobile ? (
                      <Text style={styles.contact} numberOfLines={1}>
                        {user.email ?? user.mobile}
                      </Text>
                    ) : null}
                    <Text style={styles.role}>Customer</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.name} accessibilityRole="header">
                      Your Account
                    </Text>
                    <Text style={styles.contact}>Sign in to see your orders and profile</Text>
                  </>
                )}
              </View>
            </View>
            {user ? null : <Button title="Sign In" onPress={() => router.push('/login')} />}
          </View>

          <View style={styles.menu}>
            {menu.map((item, index) => (
              <Pressable
                key={item.key}
                onPress={item.onPress}
                accessibilityRole="button"
                accessibilityLabel={item.value ? `${item.label}, ${item.value}` : item.label}
                style={({ pressed }) => [
                  styles.row,
                  index < menu.length - 1 && styles.rowDivider,
                  pressed && styles.rowPressed,
                ]}
              >
                <Ionicons name={item.icon} size={22} color={colors.navy} />
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  {item.value ? (
                    <Text style={styles.rowValue} numberOfLines={1}>
                      {item.value}
                    </Text>
                  ) : null}
                </View>
                {item.showChevron ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
              </Pressable>
            ))}
          </View>

          {user ? <Button title="Sign Out" variant="outline" icon="log-out-outline" onPress={signOut} /> : null}

          {APP_VERSION ? <Text style={styles.version}>v{APP_VERSION}</Text> : null}
        </View>
      </ScrollView>

      <GlassScreenHeader title="My Profile" fallback="/home" onHeightChange={setHeaderHeight} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screen,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: SCREEN_PADDING,
  },
  inner: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    gap: spacing.md,
  },
  card: {
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    ...cardShadow,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3E5C8A',
    borderWidth: 3,
    borderColor: colors.navySoft,
  },
  accountText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: fonts.bold,
    color: colors.navy,
  },
  contact: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  role: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  menu: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    ...cardShadow,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 54,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  rowPressed: {
    backgroundColor: colors.navySoft,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  rowLabel: {
    fontSize: 15,
    lineHeight: 21,
    fontFamily: fonts.medium,
    color: colors.navy,
  },
  rowValue: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  version: {
    marginTop: spacing.sm,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.semiBold,
    color: colors.placeholder,
    textAlign: 'center',
  },
});
