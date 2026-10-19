import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { HeaderBackFallback } from '@/components/ui/HeaderBackFallback';
import { SettingsRow } from '@/components/ui/SettingsRow';
import { useToast } from '@/components/ui/Toast';
import { BRAND } from '@/constants/brand';
import { CURRENT_LANGUAGE } from '@/constants/languages';
import { MAX_CONTENT_WIDTH, SCREEN_PADDING, colors, fonts, spacing } from '@/constants/theme';
import { useStatusBarStyle } from '@/hooks/useStatusBarStyle';
import { useDeliveryLocation } from '@/state/locationStore';
import { clearSession, useSession } from '@/state/sessionStore';
import { useWishlistCount } from '@/state/wishlistStore';

const APP_VERSION = Constants.expoConfig?.version;
const SHARE_MESSAGE = `I shop construction materials and hardware on the ${BRAND.fullName} app.`;

export default function ProfileScreen() {
  useStatusBarStyle('dark');
  const router = useRouter();
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

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <HeaderBackFallback fallback="/home" accessibilityLabel="Back to store" />
      <View style={styles.account}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={30} color={colors.textMuted} />
        </View>
        {user ? (
          <>
            <Text style={styles.title} accessibilityRole="header">
              {user.name ?? 'Techxpert customer'}
            </Text>
            {user.email || user.mobile ? (
              <Text style={styles.message}>{user.email ?? user.mobile}</Text>
            ) : null}
            <View style={styles.action}>
              <Button title="Sign Out" variant="outline" icon="log-out-outline" onPress={signOut} />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.title} accessibilityRole="header">
              Your Account
            </Text>
            <Text style={styles.message}>Log in or sign up to view your complete profile</Text>
            <View style={styles.action}>
              <Button title="Sign In" onPress={() => router.push('/login')} />
            </View>
          </>
        )}
      </View>

      <View>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          More
        </Text>
        <SettingsRow
          icon="location-outline"
          label="Delivery Location"
          value={location ? `${location.city} ${location.pincode}` : 'Not set'}
          showChevron
          onPress={() => router.push('/delivery-location')}
        />
        <SettingsRow
          icon="heart-outline"
          label="Saved Items"
          value={wishlistCount > 0 ? String(wishlistCount) : undefined}
          showChevron
          onPress={() => router.push('/wishlist')}
        />
        <SettingsRow
          icon="calculator-outline"
          label="Material Calculator"
          showChevron
          onPress={() => router.push('/calculator')}
        />
        <SettingsRow icon="share-outline" label="Share App" onPress={shareApp} />
        <SettingsRow
          icon="information-circle-outline"
          label={`About ${BRAND.fullName}`}
          showChevron
          onPress={() => router.push('/about')}
        />
        <SettingsRow
          icon="language-outline"
          label="Language"
          value={CURRENT_LANGUAGE.label}
          showChevron
          isLast
          onPress={() => router.push('/language')}
        />
      </View>

      {APP_VERSION ? <Text style={styles.version}>v{APP_VERSION}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: SCREEN_PADDING + spacing.xs,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  account: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: fonts.bold,
    color: colors.homeInk,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  action: {
    alignSelf: 'stretch',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  sectionTitle: {
    fontSize: 17,
    lineHeight: 24,
    fontFamily: fonts.bold,
    color: colors.homeInk,
    marginBottom: spacing.xs,
  },
  version: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.semiBold,
    color: colors.placeholder,
    textAlign: 'center',
    marginTop: 'auto',
  },
});
