import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/constants/theme';

type FormAlertVariant = 'error' | 'warning';

type FormAlertProps = {
  message: string;
  title?: string;
  variant?: FormAlertVariant;
};

const VARIANTS = {
  error: { icon: 'close-circle', color: colors.error, background: colors.errorSoft },
  warning: { icon: 'information-circle', color: colors.warning, background: colors.warningSoft },
} as const;

export function FormAlert({ message, title, variant = 'error' }: FormAlertProps) {
  const { icon, color, background } = VARIANTS[variant];

  return (
    <View
      style={[styles.container, { backgroundColor: background, borderColor: color }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      <Ionicons name={icon} size={20} color={color} style={styles.icon} />
      <View style={styles.textBlock}>
        {title ? <Text style={[styles.title, { color }]}>{title}</Text> : null}
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderLeftWidth: 4,
  },
  icon: {
    marginTop: 1,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.label,
  },
  message: {
    ...typography.caption,
    color: colors.text,
  },
});
