import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/constants/theme';

type DemoDataNoticeProps = {
  message?: string;
};

/** Shown whenever sample data is on screen so it is never mistaken for live inventory. */
export function DemoDataNotice({
  message = 'Sample catalogue: products, prices and stock shown here are placeholders until the Techxpert store catalogue is connected.',
}: DemoDataNoticeProps) {
  return (
    <View style={styles.container} accessibilityRole="text">
      <Ionicons name="flask-outline" size={16} color={colors.warning} style={styles.icon} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: '#F3E2B3',
  },
  icon: {
    marginTop: 1,
  },
  text: {
    ...typography.small,
    flex: 1,
    color: colors.warning,
  },
});
