import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BrandMark } from '@/components/brand/BrandMark';
import { HeaderBackFallback } from '@/components/ui/HeaderBackFallback';
import { SettingsRow } from '@/components/ui/SettingsRow';
import { BRAND, COMPANY } from '@/constants/brand';
import { MAX_CONTENT_WIDTH, SCREEN_PADDING, colors, fonts, radius, spacing } from '@/constants/theme';
import { COMPANY_FACTS, COMPANY_MISSION, COMPANY_VALUES } from '@/data/companyProfile';
import { useStatusBarStyle } from '@/hooks/useStatusBarStyle';

const APP_VERSION = Constants.expoConfig?.version;

export default function AboutUsScreen() {
  useStatusBarStyle('dark');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <HeaderBackFallback fallback="/about" accessibilityLabel={`Back to About ${BRAND.fullName}`} />
      <View style={styles.hero}>
        <BrandMark size="medium" />
        <Text style={styles.tagline}>{BRAND.tagline}</Text>
        <Text style={styles.slogan}>{COMPANY.slogan}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading} accessibilityRole="header">
          {COMPANY_MISSION.title}
        </Text>
        <Text style={styles.body}>{COMPANY_MISSION.body}</Text>
      </View>

      <View style={styles.facts}>
        {COMPANY_FACTS.map((fact) => (
          <View key={fact.label} style={styles.fact}>
            <Text style={styles.factValue}>{fact.value}</Text>
            <Text style={styles.factLabel}>{fact.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.heading} accessibilityRole="header">
          Our Core Values
        </Text>
        <Text style={styles.body}>These principles guide everything we do at Techxpert</Text>
        <View style={styles.values}>
          {COMPANY_VALUES.map((value) => (
            <View key={value.title} style={styles.value}>
              <View style={styles.valueIcon}>
                <Ionicons name={value.icon} size={20} color={colors.accent} />
              </View>
              <View style={styles.valueText}>
                <Text style={styles.valueTitle}>{value.title}</Text>
                <Text style={styles.valueBody}>{value.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading} accessibilityRole="header">
          Company
        </Text>
        <View>
          <SettingsRow icon="business-outline" label={COMPANY.legalName} value={COMPANY.certification} valueLines={2} />
          <SettingsRow
            icon="globe-outline"
            label="Website"
            value={COMPANY.websiteLabel}
            isLast
            onPress={() => Linking.openURL(COMPANY.website)}
          />
        </View>
      </View>

      {APP_VERSION ? <Text style={styles.version}>App version {APP_VERSION}</Text> : null}
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
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.logoBackdropDeep,
    backgroundColor: colors.logoBackdrop,
  },
  tagline: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.medium,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  slogan: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: fonts.semiBold,
    color: colors.logoRed,
    textAlign: 'center',
  },
  section: {
    gap: spacing.sm,
  },
  heading: {
    fontSize: 18,
    lineHeight: 26,
    fontFamily: fonts.bold,
    color: colors.homeInk,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  facts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  fact: {
    flexGrow: 1,
    flexBasis: '45%',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    gap: 2,
  },
  factValue: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  factLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textAlign: 'center',
  },
  values: {
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  value: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  valueIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  valueText: {
    flex: 1,
    gap: 2,
  },
  valueTitle: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.semiBold,
    color: colors.homeInk,
  },
  valueBody: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  version: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.semiBold,
    color: colors.placeholder,
    textAlign: 'center',
  },
});
