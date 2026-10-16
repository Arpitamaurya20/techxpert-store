import type Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { useRouter, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BrandMark } from '@/components/brand/BrandMark';
import { HeaderBackFallback } from '@/components/ui/HeaderBackFallback';
import { SettingsRow } from '@/components/ui/SettingsRow';
import { BRAND, COMPANY } from '@/constants/brand';
import { POLICIES, type PolicyId } from '@/constants/policies';
import { MAX_CONTENT_WIDTH, SCREEN_PADDING, colors, fonts, radius, spacing } from '@/constants/theme';
import { useStatusBarStyle } from '@/hooks/useStatusBarStyle';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type AboutLink = { key: string; label: string; icon: IoniconName; href: Href };

const APP_VERSION = Constants.expoConfig?.version;

const COMPANY_LINKS: AboutLink[] = [
  { key: 'us', label: 'About us', icon: 'information-circle-outline', href: '/about/us' },
  { key: 'contact', label: 'Contact us', icon: 'call-outline', href: '/about/contact' },
];

const POLICY_ICONS: Record<PolicyId, IoniconName> = {
  privacy: 'shield-checkmark-outline',
  terms: 'document-text-outline',
  cancellation: 'refresh-outline',
  shipping: 'cube-outline',
};

const POLICY_LINKS: AboutLink[] = POLICIES.map((policy) => ({
  key: policy.id,
  label: policy.title,
  icon: POLICY_ICONS[policy.id],
  href: { pathname: '/about/[policy]', params: { policy: policy.id } },
}));

export default function AboutScreen() {
  useStatusBarStyle('dark');
  const router = useRouter();

  const renderGroup = (title: string, links: AboutLink[]) => (
    <View style={styles.group}>
      <Text style={styles.groupTitle} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.card}>
        {links.map((link, index) => (
          <SettingsRow
            key={link.key}
            icon={link.icon}
            label={link.label}
            showChevron
            isLast={index === links.length - 1}
            onPress={() => router.push(link.href)}
          />
        ))}
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <HeaderBackFallback fallback="/profile" accessibilityLabel="Back to settings" />

      <View style={styles.hero}>
        <BrandMark size="medium" />
        <Text style={styles.tagline}>{BRAND.tagline}</Text>
      </View>

      {renderGroup('Company', COMPANY_LINKS)}
      {renderGroup('Policies', POLICY_LINKS)}

      <View style={styles.footer}>
        <Text style={styles.footerText}>{COMPANY.legalName}</Text>
        {APP_VERSION ? <Text style={styles.footerText}>App version {APP_VERSION}</Text> : null}
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
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.md,
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
  },
  group: {
    gap: spacing.sm,
  },
  groupTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.semiBold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: spacing.xs,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  footer: {
    alignItems: 'center',
    gap: 2,
  },
  footerText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fonts.medium,
    color: colors.placeholder,
    textAlign: 'center',
  },
});
