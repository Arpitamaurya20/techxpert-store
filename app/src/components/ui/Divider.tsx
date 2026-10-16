import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, spacing, typography } from '@/constants/theme';

type DividerProps = {
  label?: string;
};

export function Divider({ label }: DividerProps) {
  return (
    <View style={styles.row} accessibilityRole="none">
      <View style={styles.line} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: colors.border,
  },
  label: {
    ...typography.caption,
    fontFamily: fonts.semiBold,
    color: colors.textMuted,
    letterSpacing: 1,
  },
});
