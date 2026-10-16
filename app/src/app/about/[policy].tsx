import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SupportContactRows } from '@/components/store/SupportContactRows';
import { HeaderBackFallback } from '@/components/ui/HeaderBackFallback';
import { SettingsRow } from '@/components/ui/SettingsRow';
import { BRAND, COMPANY } from '@/constants/brand';
import { getPolicy, type PolicyBlock, type PolicyContent } from '@/constants/policies';
import { MAX_CONTENT_WIDTH, SCREEN_PADDING, colors, fonts, radius, spacing } from '@/constants/theme';
import { useStatusBarStyle } from '@/hooks/useStatusBarStyle';

export default function PolicyScreen() {
  useStatusBarStyle('dark');
  const { policy: policyId } = useLocalSearchParams<{ policy: string }>();
  const policy = getPolicy(policyId);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: policy?.title ?? 'Policy' }} />
      <HeaderBackFallback fallback="/about" accessibilityLabel={`Back to About ${BRAND.fullName}`} />

      {policy?.content ? (
        <PolicyDocument content={policy.content} />
      ) : (
        <>
          <View style={styles.notice}>
            <Ionicons name="document-text-outline" size={28} color={colors.textMuted} />
            <Text style={styles.noticeTitle}>
              {policy ? `${policy.title} is being prepared` : 'Page not found'}
            </Text>
            <Text style={styles.noticeText}>
              {policy
                ? `The full ${policy.title.toLowerCase()} will be published here soon. For any questions in the meantime, please contact us.`
                : 'This page is not available. For any questions, please contact us.'}
            </Text>
          </View>
          <View>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              Contact us
            </Text>
            <SupportContactRows />
          </View>
        </>
      )}
    </ScrollView>
  );
}

function PolicyDocument({ content }: { content: PolicyContent }) {
  return (
    <>
      <View style={styles.block}>
        <Text style={styles.updated}>Last updated: {content.lastUpdated}</Text>
        {content.intro.map((paragraph) => (
          <Text key={paragraph} style={styles.paragraph}>
            {paragraph}
          </Text>
        ))}
      </View>

      {content.sections.map((section) => (
        <View key={section.heading} style={styles.block}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            {section.heading}
          </Text>
          {section.blocks.map((block, index) => (
            <PolicyBlockView key={index} block={block} />
          ))}
        </View>
      ))}

      <SettingsRow
        icon="open-outline"
        label={`View on ${COMPANY.websiteLabel}`}
        isLast
        onPress={() => Linking.openURL(content.sourceUrl)}
      />
    </>
  );
}

function PolicyBlockView({ block }: { block: PolicyBlock }) {
  if (typeof block === 'string') return <Text style={styles.paragraph}>{block}</Text>;

  return (
    <View style={styles.list}>
      {block.map((item) => (
        <View key={item} style={styles.bulletRow}>
          <Text style={styles.bullet}>{'\u2022'}</Text>
          <Text style={[styles.paragraph, styles.bulletText]}>{item}</Text>
        </View>
      ))}
    </View>
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
  block: {
    gap: spacing.sm,
  },
  updated: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.semiBold,
    color: colors.textMuted,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: fonts.regular,
    color: colors.homeInk,
  },
  list: {
    gap: spacing.xs,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingLeft: spacing.xs,
  },
  bullet: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: fonts.bold,
    color: colors.textMuted,
  },
  bulletText: {
    flex: 1,
  },
  notice: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  noticeTitle: {
    fontSize: 17,
    lineHeight: 24,
    fontFamily: fonts.bold,
    color: colors.homeInk,
    textAlign: 'center',
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: fonts.bold,
    color: colors.homeInk,
  },
});
