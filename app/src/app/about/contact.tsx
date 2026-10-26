import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HeaderBackFallback } from '@/components/ui/HeaderBackFallback';
import { SettingsRow } from '@/components/ui/SettingsRow';
import { StateView } from '@/components/ui/StateView';
import { BRAND, COMPANY, SUPPORT } from '@/constants/brand';
import { MAX_CONTENT_WIDTH, SCREEN_PADDING, colors, fonts, spacing } from '@/constants/theme';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useStatusBarStyle } from '@/hooks/useStatusBarStyle';
import { getErrorMessage } from '@/services/apiClient';
import { isApiConfigured } from '@/services/apiConfig';
import { getHelpContent } from '@/services/cmsApi';

const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  `${COMPANY.legalName}, ${COMPANY.address}`,
)}`;

export default function ContactUsScreen() {
  useStatusBarStyle('dark');
  const help = useAsyncData('cms-help', getHelpContent);
  const live = help.data?.source === 'live' ? help.data.data : null;
  const phone = live ? live.phone : SUPPORT.phone;
  const phoneLabel = live ? live.phoneLabel || live.phone : SUPPORT.phoneLabel;
  const email = live ? live.email : SUPPORT.email;
  const hours = live ? live.hours : SUPPORT.hours;
  const whatsappDigits = (live?.whatsapp ?? '').replace(/[^\d]/g, '');

  if (isApiConfigured && help.status === 'loading' && !help.data) {
    return <StateView variant="loading" message="Loading contact details" />;
  }
  if (help.status === 'error') {
    return (
      <StateView
        variant="error"
        title="Couldn't load contact details"
        message={getErrorMessage(help.error)}
        actionLabel="Try Again"
        onAction={help.reload}
      />
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <HeaderBackFallback fallback="/about" accessibilityLabel={`Back to About ${BRAND.fullName}`} />
      <Text style={styles.intro}>
        Questions about products, orders or delivery? Reach the {BRAND.fullName} team.
      </Text>

      <View>
        {phone ? (
          <SettingsRow
            icon="call-outline"
            label="Call"
            value={phoneLabel || phone}
            onPress={() => Linking.openURL(`tel:${phone}`)}
          />
        ) : null}
        {whatsappDigits ? (
          <SettingsRow
            icon="logo-whatsapp"
            label="WhatsApp"
            value={live?.whatsapp}
            onPress={() => Linking.openURL(`https://wa.me/${whatsappDigits}`)}
          />
        ) : null}
        {email ? (
          <SettingsRow
            icon="mail-outline"
            label="Email"
            value={email}
            onPress={() => Linking.openURL(`mailto:${email}`)}
          />
        ) : null}
        {hours ? <SettingsRow icon="time-outline" label="Working hours" value={hours} /> : null}
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
