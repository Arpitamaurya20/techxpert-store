import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, spacing } from '@/constants/theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type SettingsRowProps = {
  icon?: IoniconName;
  label: string;
  /** Current value shown under the label, e.g. the saved delivery location. */
  value?: string;
  /** Lines of `value` to show before truncating; long values like an address need more. */
  valueLines?: number;
  /** Shows a chevron for rows that open another screen. */
  showChevron?: boolean;
  isLast?: boolean;
  accessibilityHint?: string;
  /** Omit for an information-only row. */
  onPress?: () => void;
};

/** A row in a settings-style list, separated by a hairline. */
export function SettingsRow({
  icon,
  label,
  value,
  valueLines = 1,
  showChevron = false,
  isLast = false,
  accessibilityHint,
  onPress,
}: SettingsRowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.row, !isLast && styles.divider, pressed && styles.pressed]}
    >
      {icon ? <Ionicons name={icon} size={22} color={colors.homeInk} /> : null}
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        {value ? (
          <Text style={styles.value} numberOfLines={valueLines}>
            {value}
          </Text>
        ) : null}
      </View>
      {showChevron ? <Ionicons name="chevron-forward" size={20} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    minHeight: 56,
    paddingVertical: spacing.sm + 2,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  pressed: {
    opacity: 0.6,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: fonts.regular,
    color: colors.homeInk,
  },
  value: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
});
