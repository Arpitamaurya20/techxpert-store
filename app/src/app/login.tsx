import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthHero } from '@/components/auth/AuthHero';
import { LoginForm } from '@/components/auth/LoginForm';
import { MAX_CONTENT_WIDTH, cardShadow, colors, fonts, radius, spacing, typography } from '@/constants/theme';

const COMPACT_SCREEN_HEIGHT = 760;

/**
 * OTP sign-in entry (docs/APP_TEAM_PULL_BRIEF.md).
 * Store JWT only — guests may skip and browse; PayU later requires sign-in.
 */
export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const isCompact = height < COMPACT_SCREEN_HEIGHT;

  const skipLogin = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home');
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <AuthHero compact={isCompact} />

          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
            <View style={styles.content}>
              <Pressable
                onPress={skipLogin}
                accessibilityRole="button"
                accessibilityHint="Opens the store without signing in"
                style={({ pressed }) => [styles.skip, pressed && styles.skipPressed]}
              >
                <Text style={styles.skipText}>Continue as guest</Text>
              </Pressable>

              <View style={styles.heading}>
                <Text style={styles.title} accessibilityRole="header">
                  Sign in with mobile
                </Text>
                <Text style={styles.subtitle}>
                  We will text a one-time code. The same number works for Homecare services and this store.
                </Text>
              </View>

              <LoginForm />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screen,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  sheet: {
    flexGrow: 1,
    marginTop: -radius.xl,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.background,
    ...cardShadow,
  },
  content: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    gap: spacing.lg,
  },
  skip: {
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  skipPressed: {
    opacity: 0.7,
  },
  skipText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.semiBold,
    color: colors.navy,
  },
  heading: {
    gap: spacing.sm,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: fonts.bold,
    color: colors.navy,
    letterSpacing: -0.3,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
