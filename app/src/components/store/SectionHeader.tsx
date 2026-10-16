import { StyleSheet, Text, View } from 'react-native';

import { TextLink } from '@/components/ui/TextLink';
import { colors, spacing, typography } from '@/constants/theme';

type SectionHeaderProps = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function SectionHeader({ title, actionLabel = 'View All', onAction }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {onAction ? (
        <TextLink
          label={actionLabel}
          onPress={onAction}
          accessibilityHint={`Shows all ${title.toLowerCase()}`}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.sectionTitle,
    color: colors.text,
  },
});
