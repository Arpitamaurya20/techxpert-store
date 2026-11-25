import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, View, type TextInput } from 'react-native';

import { Button } from '@/components/ui/Button';
import { FormAlert } from '@/components/ui/FormAlert';
import { TextField } from '@/components/ui/TextField';
import { colors, spacing, typography } from '@/constants/theme';
import { isApiConfigured } from '@/services/apiConfig';
import { AuthError, getAuthErrorMessage, sendOtp } from '@/services/authService';
import { normalizeIndianMobile, validateMobile } from '@/utils/validation';

type FormError = {
  title: string;
  message: string;
};

/**
 * Phone → send OTP → otp-login (docs/STORE_CUSTOMER_API.md + APP_TEAM_PULL_BRIEF.md).
 * Production refuses password `/auth/login` — OTP only.
 */
export function LoginForm() {
  const router = useRouter();
  const phoneRef = useRef<TextInput>(null);
  const isSubmittingRef = useRef(false);

  const [phone, setPhone] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<FormError | null>(null);

  const phoneError = validateMobile(phone);
  const visibleError = touched || submitAttempted ? phoneError : undefined;

  const handleSubmit = async () => {
    if (isSubmittingRef.current) return;

    setSubmitAttempted(true);
    setFormError(null);

    if (phoneError) {
      phoneRef.current?.focus();
      return;
    }

    const normalized = normalizeIndianMobile(phone);
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    Keyboard.dismiss();

    try {
      const result = await sendOtp(normalized);
      router.push({
        pathname: '/otp-login',
        params: {
          phone: result.phone,
          ...(result.devOtp ? { devOtp: result.devOtp } : {}),
        },
      });
    } catch (error) {
      const notConfigured = error instanceof AuthError && error.code === 'NOT_CONFIGURED';
      const smsDown = error instanceof AuthError && error.code === 'SERVER';
      setFormError({
        title: notConfigured
          ? 'Sign-in unavailable'
          : smsDown
            ? 'Could not send code'
            : 'Could not send code',
        message: getAuthErrorMessage(error),
      });
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {__DEV__ && !isApiConfigured ? (
        <FormAlert
          variant="warning"
          title="Developer note: API not configured"
          message="Set EXPO_PUBLIC_API_BASE_URL (blue) and EXPO_PUBLIC_GREEN_API_BASE_URL (green) in .env.local."
        />
      ) : null}

      {formError ? <FormAlert title={formError.title} message={formError.message} /> : null}

      <View style={styles.fields}>
        <TextField
          ref={phoneRef}
          label="Mobile number"
          placeholder="10-digit mobile number"
          leftIcon="call-outline"
          value={phone}
          onChangeText={(text) => {
            setPhone(text);
            if (formError) setFormError(null);
          }}
          onBlur={() => setTouched(true)}
          error={visibleError}
          editable={!isSubmitting}
          keyboardType="phone-pad"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="tel"
          textContentType="telephoneNumber"
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
          maxLength={14}
        />
        <Text style={styles.hint}>India (+91). Code expires in about 10 minutes.</Text>
      </View>

      <Button title="Send OTP" loadingTitle="Sending…" onPress={handleSubmit} loading={isSubmitting} />

      <Text style={styles.footerNote}>
        New here? Enter your number — we create your account when you verify the code.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  fields: {
    gap: spacing.sm,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  footerNote: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
