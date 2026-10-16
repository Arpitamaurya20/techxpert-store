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

import { LoginForm } from '@/components/auth/LoginForm';
import { BrandMark } from '@/components/brand/BrandMark';
import { MAX_CONTENT_WIDTH, colors, fonts, radius, spacing } from '@/constants/theme';

const COMPACT_SCREEN_HEIGHT = 760;

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const isCompact = height < COMPACT_SCREEN_HEIGHT;

  // Login is opened either at app start (nothing behind it) or from Settings.
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
      {/* "padding" only adds space for the part of the keyboard that actually overlaps this view,
          so it is safe on Android edge-to-edge as well as iOS. */}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.lg },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.content}>
            <Pressable
              onPress={skipLogin}
              accessibilityRole="button"
              accessibilityHint="Opens the store without signing in"
              style={({ pressed }) => [styles.skip, pressed && styles.skipPressed]}
            >
              <Text style={styles.skipText}>Skip login</Text>
            </Pressable>

            <View style={[styles.brand, isCompact && styles.brandCompact]}>
              <BrandMark size={isCompact ? 'medium' : 'large'} />
              <Text style={styles.title} accessibilityRole="header">
                Sign up or Log in
              </Text>
            </View>

            <LoginForm />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  content: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
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
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.semiBold,
    color: colors.text,
  },
  brand: {
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  brandCompact: {
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 18,
    lineHeight: 26,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
