import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HeaderBackFallback } from '@/components/ui/HeaderBackFallback';
import { SettingsRow } from '@/components/ui/SettingsRow';
import { BRAND, COMPANY, SUPPORT } from '@/constants/brand';
import { MAX_CONTENT_WIDTH, SCREEN_PADDING, colors, fonts, spacing } from '@/constants/theme';
import { useStatusBarStyle } from '@/hooks/useStatusBarStyle';

const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  `${COMPANY.legalName}, ${COMPANY.address}`,
)}`;

export default function ContactUsScreen() {
  useStatusBarStyle('dark');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <HeaderBackFallback fallback="/about" accessibilityLabel={`Back to About ${BRAND.fullName}`} />
      <Text style={styles.intro}>
        Questions about products, orders or delivery? Reach the {BRAND.fullName} team.
      </Text>

      <View>
        <SettingsRow
          icon="call-outline"
          label="Call"
          value={SUPPORT.phoneLabel}
          onPress={() => Linking.openURL(`tel:${SUPPORT.phone}`)}
        />
        <SettingsRow
          icon="mail-outline"
          label="Email"
          value={SUPPORT.email}
          onPress={() => Linking.openURL(`mailto:${SUPPORT.email}`)}
        />
        <SettingsRow icon="time-outline" label="Working hours" value={SUPPORT.hours} />
        <SettingsRow
          icon="globe-outline"
          label="Website"
          value={COMPANY.websiteLabel}
          onPress={() => Linking.openURL(COMPANY.website)}
        />
        <SettingsRow
          icon="business-outline"
          label="Office"
          value={`${COMPANY.legalName}\n${COMPANY.address}`}
          valueLines={4}
          accessibilityHint="Opens the office location in maps"
          isLast
          onPress={() => Linking.openURL(MAPS_URL)}
        />
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
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    padding: SCREEN_PADDING + spacing.xs,
    gap: spacing.md,
  },
  intro: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
});
