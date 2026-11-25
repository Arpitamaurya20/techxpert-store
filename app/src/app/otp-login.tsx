import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthHero } from '@/components/auth/AuthHero';
import { Button } from '@/components/ui/Button';
import { FormAlert } from '@/components/ui/FormAlert';
import { TextField } from '@/components/ui/TextField';
import { TextLink } from '@/components/ui/TextLink';
import { MAX_CONTENT_WIDTH, cardShadow, colors, fonts, radius, spacing, typography } from '@/constants/theme';
import { AuthError, getAuthErrorMessage, sendOtp, verifyOtp } from '@/services/authService';
import { setDeliveryLocation } from '@/state/locationStore';
import { mergeCartIntoAccount } from '@/state/cartStore';
import { setSession } from '@/state/sessionStore';
import { normalizeIndianMobile, validateMobile } from '@/utils/validation';

const COMPACT_SCREEN_HEIGHT = 760;

type FormError = { title: string; message: string };

export default function OtpLoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const isCompact = height < COMPACT_SCREEN_HEIGHT;
  const params = useLocalSearchParams<{ phone?: string; devOtp?: string }>();
  const otpRef = useRef<TextInput>(null);
  const isSubmittingRef = useRef(false);

  const phone = normalizeIndianMobile(params.phone ?? '');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [formError, setFormError] = useState<FormError | null>(null);
  const [info, setInfo] = useState<string | null>(
    params.devOtp ? `Local / green test code: ${params.devOtp}` : null
  );

  const phoneError = validateMobile(phone);

  const goToStore = () => {
    router.replace('/home');
  };

  const handleVerify = async () => {
    if (isSubmittingRef.current) return;
    setFormError(null);

    if (phoneError) {
      setFormError({ title: 'Missing mobile number', message: phoneError });
      return;
    }
    if (!/^\d{4,8}$/.test(otp.trim())) {
      setFormError({ title: 'Enter the code', message: 'Enter the one-time code sent to your phone.' });
      otpRef.current?.focus();
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    Keyboard.dismiss();

    try {
      const response = await verifyOtp({
        phone,
        otp: otp.trim(),
        ...(name.trim() ? { name: name.trim() } : {}),
      });
      await setSession(response);
      if (response.user.deliveryLocation) setDeliveryLocation(response.user.deliveryLocation);
      try {
        // JWT is stored. The guest sessionId is left in place for merge.
        await mergeCartIntoAccount();
      } catch {
        // The guest cart stays on screen. Cart shows the error and a retry.
      }
      goToStore();
    } catch (error) {
      const notConfigured = error instanceof AuthError && error.code === 'NOT_CONFIGURED';
      setFormError({
        title: notConfigured ? 'Sign-in unavailable' : 'Could not verify code',
        message: getAuthErrorMessage(error),
      });
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (isResending || isSubmitting || phoneError) return;
    setFormError(null);
    setIsResending(true);
    try {
      const result = await sendOtp(phone);
      setOtp('');
      setInfo(result.devOtp ? `Local / green test code: ${result.devOtp}` : 'A new code was sent.');
      otpRef.current?.focus();
    } catch (error) {
      setFormError({
        title: 'Could not resend code',
        message: getAuthErrorMessage(error),
      });
    } finally {
      setIsResending(false);
    }
  };

  if (phoneError) {
    return (
      <View style={[styles.screen, styles.centered, { paddingTop: insets.top + spacing.lg }]}>
        <FormAlert title="Start from Sign in" message="Open Sign in and enter your mobile number first." />
        <Button title="Back to Sign in" onPress={() => router.replace('/login')} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <AuthHero compact={isCompact} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
            <View style={styles.inner}>
              <View style={styles.heading}>
                <Text style={styles.title} accessibilityRole="header">
                  Enter the code
                </Text>
                <Text style={styles.subtitle}>
                  We sent a one-time code to +91 {phone}. It expires in about 10 minutes.
                </Text>
              </View>

              {info ? <FormAlert variant="warning" title="Developer note" message={info} /> : null}
              {formError ? <FormAlert title={formError.title} message={formError.message} /> : null}

              <TextField
                ref={otpRef}
                label="One-time code"
                placeholder="Enter OTP"
                leftIcon="keypad-outline"
                value={otp}
                onChangeText={(text) => {
                  setOtp(text.replace(/\D/g, '').slice(0, 8));
                  if (formError) setFormError(null);
                }}
                editable={!isSubmitting}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                returnKeyType="go"
                onSubmitEditing={handleVerify}
                maxLength={8}
              />

              <TextField
                label="Name (optional for new accounts)"
                placeholder="Your name"
                leftIcon="person-outline"
                value={name}
                onChangeText={setName}
                editable={!isSubmitting}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={handleVerify}
              />

              <Button
                title="Verify and continue"
                loadingTitle="Verifying…"
                onPress={handleVerify}
                loading={isSubmitting}
              />

              <View style={styles.resendRow}>
                <Text style={styles.footerText}>Didn&apos;t get it?</Text>
                <TextLink
                  label={isResending ? 'Sending…' : 'Resend code'}
                  onPress={handleResend}
                  disabled={isResending || isSubmitting}
                />
              </View>

              <TextLink
                label="Change mobile number"
                onPress={() => router.replace('/login')}
                disabled={isSubmitting}
              />
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
  centered: {
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
    justifyContent: 'center',
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
  inner: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    gap: spacing.lg,
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
    ...typography.body,
    color: colors.textMuted,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  footerText: {
    ...typography.body,
    color: colors.textMuted,
  },
});
