import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BRAND, SUPPORT } from '@/constants/brand';
import { MAX_CONTENT_WIDTH, SCREEN_PADDING, cardShadow, colors, fonts, radius, spacing } from '@/constants/theme';
import { useStatusBarStyle } from '@/hooks/useStatusBarStyle';

const HERO_BACKGROUND = '#E8F5FD';
const HERO_HEIGHT = 120;
const HERO_IMAGE_SIZE = 150;
const AGENT_IMAGE = require('../../../assets/images/help-agent.jpg');

type HelpLink = {
  key: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
  href: Href;
};

const HELP_LINKS: HelpLink[] = [
  {
    key: 'orders',
    icon: 'cube-outline',
    title: 'Track Your Order',
    subtitle: 'Check your order status',
    href: '/orders',
  },
  {
    key: 'refunds',
    icon: 'refresh-outline',
    title: 'Return & Refund',
    subtitle: 'Cancellation & refund policy',
    href: { pathname: '/about/[policy]', params: { policy: 'cancellation' } },
  },
  {
    key: 'faq',
    icon: 'help-circle-outline',
    title: 'FAQs',
    subtitle: 'Find answers to common questions',
    href: '/faq',
  },
  {
    key: 'contact',
    icon: 'call-outline',
    title: 'Contact Us',
    subtitle: 'Call, email or visit us',
    href: '/about/contact',
  },
  {
    key: 'about',
    icon: 'information-circle-outline',
    title: 'About Us',
    subtitle: `Learn more about ${BRAND.fullName}`,
    href: '/about/us',
  },
];

export default function HelpScreen() {
  useStatusBarStyle('light');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const call = () => Linking.openURL(`tel:${SUPPORT.phone}`);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate('/home');
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerInner}>
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            style={({ pressed }) => [styles.backButton, pressed && styles.backPressed]}
          >
            <Ionicons name="arrow-back" size={24} color={colors.white} />
          </Pressable>
          <Text style={styles.title} accessibilityRole="header">
            Help & Support
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.inner}>
          <View style={styles.hero}>
            <View style={styles.heroText}>
              <Text style={styles.heroTitle} accessibilityRole="header">
                Need Help?
              </Text>
              <Text style={styles.heroBody}>
                We are here to assist you 24/7. Get quick support for all your queries.
              </Text>
            </View>
            <Image
              source={AGENT_IMAGE}
              style={styles.heroImage}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          </View>

          <View style={styles.menu}>
            {HELP_LINKS.map((link, index) => (
              <Pressable
                key={link.key}
                onPress={() => router.push(link.href)}
                accessibilityRole="button"
                accessibilityLabel={`${link.title}. ${link.subtitle}`}
                style={({ pressed }) => [
                  styles.row,
                  index < HELP_LINKS.length - 1 && styles.rowDivider,
                  pressed && styles.rowPressed,
                ]}
              >
                <View style={styles.rowIcon}>
                  <Ionicons name={link.icon} size={20} color={colors.navy} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{link.title}</Text>
                  <Text style={styles.rowSubtitle} numberOfLines={1}>
                    {link.subtitle}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.navy} />
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={call}
            accessibilityRole="button"
            accessibilityLabel={`Call us on ${SUPPORT.phoneLabel}, ${SUPPORT.hours}`}
            style={({ pressed }) => [styles.callCard, pressed && styles.rowPressed]}
          >
            <View style={styles.callIcon}>
              <Ionicons name="call" size={24} color={colors.white} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.callLabel}>Call Us</Text>
              <Text style={styles.callNumber}>{SUPPORT.phoneLabel}</Text>
              <Text style={styles.callHours}>({SUPPORT.hours})</Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  header: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: spacing.lg,
    backgroundColor: colors.navy,
  },
  headerInner: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 40,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  backPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  title: {
    fontSize: 20,
    lineHeight: 28,
    fontFamily: fonts.bold,
    color: colors.white,
  },
  scroll: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.screen,
  },
  content: {
    padding: SCREEN_PADDING,
  },
  inner: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    gap: spacing.md,
  },
  hero: {
    minHeight: HERO_HEIGHT,
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radius.lg,
    backgroundColor: HERO_BACKGROUND,
  },
  heroText: {
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingLeft: spacing.lg,
    paddingRight: HERO_HEIGHT,
  },
  heroTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: fonts.bold,
    color: colors.navy,
  },
  heroBody: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.regular,
    color: colors.text,
  },
  heroImage: {
    position: 'absolute',
    right: -18,
    bottom: HERO_HEIGHT - HERO_IMAGE_SIZE,
    width: HERO_IMAGE_SIZE,
    height: HERO_IMAGE_SIZE,
  },
  menu: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    ...cardShadow,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  rowPressed: {
    backgroundColor: colors.navySoft,
  },
  rowIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: colors.navySoft,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.semiBold,
    color: colors.navy,
  },
  rowSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  callCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    ...cardShadow,
  },
  callIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: colors.navy,
  },
  callLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  callNumber: {
    fontSize: 17,
    lineHeight: 24,
    fontFamily: fonts.bold,
    color: colors.navy,
  },
  callHours: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
});
