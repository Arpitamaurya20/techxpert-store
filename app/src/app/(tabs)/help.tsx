import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SUPPORT } from '@/constants/brand';
import { MAX_CONTENT_WIDTH, colors, fonts, radius, spacing, typography } from '@/constants/theme';
import { useStatusBarStyle } from '@/hooks/useStatusBarStyle';

type HelpRowProps = {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  accessibilityLabel: string;
  onPress: () => void;
};

function HelpRow({ icon, label, value, accessibilityLabel, onPress }: HelpRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={colors.accent} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export default function HelpScreen() {
  useStatusBarStyle('dark');
  const router = useRouter();
  const call = () => Linking.openURL(`tel:${SUPPORT.phone}`);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.inner}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="headset" size={26} color={colors.white} />
          </View>
          <Text style={styles.heroTitle} accessibilityRole="header">
            We&apos;re here to help
          </Text>
          <Text style={styles.heroText}>
            Questions about products, bulk or project orders? Talk to the Techxpert India team.
          </Text>
          <Text style={styles.heroHours}>{SUPPORT.hours}</Text>
          <Pressable
            onPress={call}
            accessibilityRole="button"
            accessibilityLabel={`Call ${SUPPORT.phoneLabel}`}
            style={({ pressed }) => [styles.callButton, pressed && styles.callButtonPressed]}
          >
            <Ionicons name="call" size={18} color={colors.white} />
            <Text style={styles.callText}>Call {SUPPORT.phoneLabel}</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Other ways to reach us</Text>
        <HelpRow
          icon="call-outline"
          label="Toll-free helpline"
          value={SUPPORT.phoneLabel}
          accessibilityLabel={`Call ${SUPPORT.phoneLabel}`}
          onPress={call}
        />
        <HelpRow
          icon="mail-outline"
          label="Email"
          value={SUPPORT.email}
          accessibilityLabel={`Email ${SUPPORT.email}`}
          onPress={() => Linking.openURL(`mailto:${SUPPORT.email}`)}
        />
        <HelpRow
          icon="information-circle-outline"
          label="Company"
          value="About Techxpert India"
          accessibilityLabel="About Techxpert India"
          onPress={() => router.push('/about')}
        />

        <Text style={styles.note}>
          These are the published store contacts. This screen does not open WhatsApp or start a service booking.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  inner: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    gap: spacing.md,
  },
  hero: {
    alignItems: 'flex-start',
    gap: spacing.xs,
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  heroIcon: {
    width: 48,
    height: 48,
    marginBottom: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  heroTitle: {
    ...typography.title,
    color: colors.white,
  },
  heroText: {
    ...typography.caption,
    color: colors.textOnDark,
  },
  heroHours: {
    marginTop: spacing.xs,
    ...typography.small,
    fontFamily: fonts.semiBold,
    color: '#FFB38A',
  },
  callButton: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 50,
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  callButtonPressed: {
    backgroundColor: colors.accentPressed,
  },
  callText: {
    ...typography.button,
    color: colors.white,
  },
  sectionTitle: {
    marginTop: spacing.sm,
    ...typography.sectionTitle,
    fontSize: 16,
    color: colors.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 64,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  pressed: {
    backgroundColor: colors.surface,
  },
  rowIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: colors.accentSoft,
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
  note: {
    marginTop: spacing.sm,
    ...typography.small,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
});
