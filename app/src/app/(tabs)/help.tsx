import Ionicons from '@expo/vector-icons/Ionicons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { SUPPORT } from '@/constants/brand';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';
import { useStatusBarStyle } from '@/hooks/useStatusBarStyle';

const HELP_PHONE = SUPPORT.phone;
const HELP_PHONE_LABEL = SUPPORT.phoneLabel;
const HELP_EMAIL = SUPPORT.email;

export default function HelpScreen() {
  useStatusBarStyle('dark');

  return (
    <View style={styles.screen}>
      <Text style={styles.title} accessibilityRole="header">
        Need help?
      </Text>
      <Text style={styles.message}>
        Call or email Techxpert India. These are the published store contacts — this screen does not
        open WhatsApp and does not start a service booking.
      </Text>

      <Pressable
        onPress={() => Linking.openURL(`tel:${HELP_PHONE}`)}
        accessibilityRole="button"
        accessibilityLabel={`Call ${HELP_PHONE_LABEL}`}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <Ionicons name="call-outline" size={22} color={colors.accent} />
        <View style={styles.rowText}>
          <Text style={styles.label}>Call</Text>
          <Text style={styles.value}>{HELP_PHONE_LABEL}</Text>
        </View>
      </Pressable>

      <Pressable
        onPress={() => Linking.openURL(`mailto:${HELP_EMAIL}`)}
        accessibilityRole="button"
        accessibilityLabel={`Email ${HELP_EMAIL}`}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <Ionicons name="mail-outline" size={22} color={colors.accent} />
        <View style={styles.rowText}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{HELP_EMAIL}</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    ...typography.title,
    color: colors.homeInk,
  },
  message: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 64,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  pressed: {
    backgroundColor: colors.surface,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  label: {
    ...typography.small,
    color: colors.textMuted,
  },
  value: {
    ...typography.label,
    fontFamily: fonts.semiBold,
    color: colors.text,
  },
});
