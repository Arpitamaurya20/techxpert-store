import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, View, type TextInput } from 'react-native';

import { Button } from '@/components/ui/Button';
import { FormAlert } from '@/components/ui/FormAlert';
import { PasswordField } from '@/components/ui/PasswordField';
import { TextField } from '@/components/ui/TextField';
import { TextLink } from '@/components/ui/TextLink';
import { colors, spacing, typography } from '@/constants/theme';
import { isApiConfigured } from '@/services/apiConfig';
import { AuthError, getAuthErrorMessage, signIn } from '@/services/authService';
import { setDeliveryLocation } from '@/state/locationStore';
import { setSession } from '@/state/sessionStore';
import { validateLoginForm, type LoginFormValues } from '@/utils/validation';

type FieldName = keyof LoginFormValues;

type FormError = {
  title: string;
  message: string;
};

export function LoginForm() {
  const router = useRouter();
  const passwordRef = useRef<TextInput>(null);
  const identifierRef = useRef<TextInput>(null);
  // State updates are async, so a ref is used to block a second tap that lands before the re-render.
  const isSubmittingRef = useRef(false);

  const [values, setValues] = useState<LoginFormValues>({ identifier: '', password: '' });
  const [touched, setTouched] = useState<Record<FieldName, boolean>>({
    identifier: false,
    password: false,
  });
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<FormError | null>(null);

  const { errors } = validateLoginForm(values);
  const visibleError = (field: FieldName) =>
    touched[field] || submitAttempted ? errors[field] : undefined;

  const handleChange = (field: FieldName) => (text: string) => {
    setValues((current) => ({ ...current, [field]: text }));
    if (formError) setFormError(null);
  };

  const handleBlur = (field: FieldName) => () => {
    setTouched((current) => ({ ...current, [field]: true }));
  };

  // Login is opened either at app start (nothing behind it) or from the Profile tab.
  const goToStore = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home');
    }
  };

  const handleSubmit = async () => {
    if (isSubmittingRef.current) return;

    setSubmitAttempted(true);
    setFormError(null);

    const result = validateLoginForm(values);
    if (!result.isValid) {
      (result.errors.identifier ? identifierRef : passwordRef).current?.focus();
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    Keyboard.dismiss();

    try {
      const response = await signIn({
        identifier: result.identifier,
        identifierType: result.identifierType,
        password: values.password,
      });
      setSession(response);
      if (response.user.deliveryLocation) setDeliveryLocation(response.user.deliveryLocation);
      setValues((current) => ({ ...current, password: '' }));
      goToStore();
    } catch (error) {
      const notConfigured = error instanceof AuthError && error.code === 'NOT_CONFIGURED';
      setFormError({
        title: notConfigured ? 'Sign-in unavailable' : 'Could not sign in',
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
          message="Set EXPO_PUBLIC_API_BASE_URL in .env.local to enable sign-in."
        />
      ) : null}

      {formError ? <FormAlert title={formError.title} message={formError.message} /> : null}

      <View style={styles.fields}>
        <TextField
          ref={identifierRef}
          label="Mobile number or email"
          placeholder="Enter mobile number or email"
          leftIcon="person-outline"
          value={values.identifier}
          onChangeText={handleChange('identifier')}
          onBlur={handleBlur('identifier')}
          error={visibleError('identifier')}
          editable={!isSubmitting}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="username"
          textContentType="username"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />

        <View style={styles.passwordBlock}>
          <PasswordField
            ref={passwordRef}
            label="Password"
            placeholder="Enter your password"
            value={values.password}
            onChangeText={handleChange('password')}
            onBlur={handleBlur('password')}
            error={visibleError('password')}
            editable={!isSubmitting}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />
          <View style={styles.forgotRow}>
            <TextLink
              label="Forgot Password?"
              onPress={() => router.push('/forgot-password')}
              disabled={isSubmitting}
              accessibilityHint="Opens password reset"
            />
          </View>
        </View>
      </View>

      <Button
        title="Continue"
        loadingTitle="Signing in…"
        onPress={handleSubmit}
        loading={isSubmitting}
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>New to Techxpert?</Text>
        <TextLink
          label="Create Account"
          onPress={() => router.push('/register')}
          disabled={isSubmitting}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  fields: {
    gap: spacing.md,
  },
  passwordBlock: {
    gap: spacing.sm,
  },
  forgotRow: {
    alignItems: 'flex-end',
  },
  footer: {
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
