import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/constants/theme';

import { Button } from './Button';
import type { IconName } from './TextField';

type StateViewProps =
  | { variant: 'loading'; message?: string; compact?: boolean }
  | {
      variant: 'error' | 'empty';
      title: string;
      message?: string;
      icon?: IconName;
      actionLabel?: string;
      onAction?: () => void;
      compact?: boolean;
    };

/** Shared loading, empty and error message block with an optional retry/action button. */
export function StateView(props: StateViewProps) {
  if (props.variant === 'loading') {
    return (
      <View
        style={[styles.container, props.compact && styles.compact]}
        accessibilityRole="progressbar"
        accessibilityLabel={props.message ?? 'Loading'}
      >
        <ActivityIndicator color={colors.accent} size="large" />
        {props.message ? <Text style={styles.message}>{props.message}</Text> : null}
      </View>
    );
  }

  const isError = props.variant === 'error';
  const icon = props.icon ?? (isError ? 'cloud-offline-outline' : 'search-outline');

  return (
    <View
      style={[styles.container, props.compact && styles.compact]}
      accessibilityRole={isError ? 'alert' : undefined}
    >
      <View style={[styles.iconCircle, isError && styles.iconCircleError]}>
        <Ionicons name={icon} size={26} color={isError ? colors.error : colors.textMuted} />
      </View>
      <Text style={styles.title}>{props.title}</Text>
      {props.message ? <Text style={styles.message}>{props.message}</Text> : null}
      {props.actionLabel && props.onAction ? (
        <View style={styles.action}>
          <Button
            title={props.actionLabel}
            variant="outline"
            icon={isError ? 'refresh' : undefined}
            onPress={props.onAction}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
  },
  compact: {
    paddingVertical: spacing.xl,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.xs,
  },
  iconCircleError: {
    backgroundColor: colors.errorSoft,
    borderColor: colors.errorSoft,
  },
  title: {
    ...typography.label,
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 360,
  },
  action: {
    marginTop: spacing.sm,
    minWidth: 180,
  },
});
