import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SupportContactRows } from '@/components/store/SupportContactRows';
import { HeaderBackFallback } from '@/components/ui/HeaderBackFallback';
import { StateView } from '@/components/ui/StateView';
import { BRAND, SUPPORT } from '@/constants/brand';
import { MAX_CONTENT_WIDTH, SCREEN_PADDING, colors, fonts, radius, spacing, typography } from '@/constants/theme';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useStatusBarStyle } from '@/hooks/useStatusBarStyle';
import { getErrorMessage } from '@/services/apiClient';
import { isApiConfigured } from '@/services/apiConfig';
import { getHelpContent } from '@/services/cmsApi';

type FaqAction = { label: string; href?: Href; url?: string };
type Faq = { question: string; answer: string; action?: FaqAction };

const FAQS: Faq[] = [
  {
    question: 'How do I place an order?',
    answer:
      'Open any product, choose the quantity and tap Add to Cart. Then open your cart from the cart icon and go to checkout to review and place the order.',
  },
  {
    question: 'How do I set my delivery location?',
    answer: 'Tap "Deliver to" at the top of the Home screen and enter your pincode.',
    action: { label: 'Set delivery location', href: '/delivery-location' },
  },
  {
    question: 'How do I reorder items I bought before?',
    answer:
      'Open the Order Again tab. Once you sign in, your past orders appear there so you can add their items to your cart again.',
    action: { label: 'Open Order Again', href: '/orders' },
  },
  {
    question: 'Do you take bulk or project orders?',
    answer: `For site or project quantities, call the ${BRAND.fullName} team on ${SUPPORT.phoneLabel} and they will help you with your requirement.`,
    action: { label: `Call ${SUPPORT.phoneLabel}`, url: `tel:${SUPPORT.phone}` },
  },
  {
    question: 'How do I cancel an order or ask for a refund?',
    answer: 'See our Cancellation & Refunds policy, or contact support with your order details.',
    action: {
      label: 'Cancellation & Refunds',
      href: { pathname: '/about/[policy]', params: { policy: 'cancellation' } },
    },
  },
  {
    question: `How can I contact ${BRAND.fullName}?`,
    answer: `Call ${SUPPORT.phoneLabel} (${SUPPORT.hours}) or email ${SUPPORT.email}.`,
    action: { label: 'Contact us', href: '/about/contact' },
  },
];

export default function FaqScreen() {
  useStatusBarStyle('dark');
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(0);
  const help = useAsyncData('cms-help', getHelpContent);
  const published = help.data?.source === 'live' ? help.data.data.faqs : undefined;

  if (isApiConfigured && help.status === 'loading' && !help.data) {
    return <StateView variant="loading" message="Loading questions" />;
  }
  if (help.status === 'error') {
    return (
      <StateView
        variant="error"
        title="Couldn't load questions"
        message={getErrorMessage(help.error)}
        actionLabel="Try Again"
        onAction={help.reload}
      />
    );
  }

  if (published && published.length === 0) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <HeaderBackFallback fallback="/help" accessibilityLabel="Back to Help" />
        <StateView variant="empty" compact icon="help-circle-outline" title="Questions will be published here" />
        <SupportContactRows />
      </ScrollView>
    );
  }

  const questions = published
    ? published.map((faq) => ({ question: faq.question, answer: faq.answer, action: undefined }))
    : FAQS;

  const runAction = (action: FaqAction) => {
    if (action.url) {
      Linking.openURL(action.url);
    } else if (action.href) {
      router.push(action.href);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <HeaderBackFallback fallback="/help" accessibilityLabel="Back to Help" />
      {questions.map((faq, index) => {
        const expanded = open === index;
        const { action } = faq;
        return (
          <View key={faq.question} style={styles.card}>
            <Pressable
              onPress={() => setOpen(expanded ? null : index)}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              style={({ pressed }) => [styles.question, pressed && styles.pressed]}
            >
              <Text style={styles.questionText}>{faq.question}</Text>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.navy} />
            </Pressable>
            {expanded ? (
              <View style={styles.answer}>
                <Text style={styles.answerText}>{faq.answer}</Text>
                {action ? (
                  <Pressable
                    onPress={() => runAction(action)}
                    accessibilityRole="button"
                    hitSlop={6}
                    style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
                  >
                    <Text style={styles.actionText}>{action.label}</Text>
                    <Ionicons name="arrow-forward" size={14} color={colors.accent} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screen,
  },
  content: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    padding: SCREEN_PADDING,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  card: {
    overflow: 'hidden',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  question: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  pressed: {
    backgroundColor: colors.navySoft,
  },
  questionText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.semiBold,
    color: colors.navy,
  },
  answer: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  answerText: {
    ...typography.caption,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  action: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  actionPressed: {
    opacity: 0.7,
  },
  actionText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.semiBold,
    color: colors.accent,
  },
});
