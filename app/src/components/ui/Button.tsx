import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { MIN_TOUCH_TARGET, colors, radius, spacing, typography } from '@/constants/theme';

import type { IconName } from './TextField';

type ButtonVariant = 'primary' | 'outline';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  loadingTitle?: string;
  disabled?: boolean;
  accessibilityHint?: string;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  loadingTitle,
  disabled = false,
  accessibilityHint,
}: ButtonProps) {
  const isPrimary = variant === 'primary';
  const isInactive = disabled || loading;
  const contentColor = isPrimary ? colors.white : colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={isInactive}
      accessibilityRole="button"
      accessibilityLabel={loading && loadingTitle ? loadingTitle : title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isInactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.outline,
        pressed && (isPrimary ? styles.primaryPressed : styles.outlinePressed),
        disabled && !loading && styles.disabled,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={contentColor} />
        ) : icon ? (
          <Ionicons name={icon} size={20} color={contentColor} />
        ) : null}
        <Text style={[styles.title, { color: contentColor }]}>
          {loading && loadingTitle ? loadingTitle : title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH_TARGET + 6,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  primaryPressed: {
    backgroundColor: colors.accentPressed,
  },
  outline: {
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  outlinePressed: {
    backgroundColor: colors.surface,
  },
  disabled: {
    opacity: 0.5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.button,
  },
});
