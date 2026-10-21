import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { MAX_CONTENT_WIDTH, SCREEN_PADDING, cardShadow, colors, fonts, radius, spacing } from '@/constants/theme';
import { useStatusBarStyle } from '@/hooks/useStatusBarStyle';
import { formatPrice } from '@/utils/format';

const BACKGROUND = [colors.successSoft, colors.screen] as const;

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/** Decorative confetti around the check badge; positions are relative to the badge area. */
const CONFETTI = [
  { top: 6, left: '14%', color: colors.accent, rotate: '25deg' },
  { top: 34, left: '6%', color: colors.navy, rotate: '-35deg' },
  { top: 78, left: '18%', color: colors.success, rotate: '60deg' },
  { top: 0, left: '36%', color: '#F2B705', rotate: '-15deg' },
  { top: 10, right: '30%', color: colors.navy, rotate: '40deg' },
  { top: 2, right: '14%', color: colors.success, rotate: '-50deg' },
  { top: 40, right: '6%', color: colors.accent, rotate: '15deg' },
  { top: 84, right: '18%', color: '#F2B705', rotate: '-30deg' },
] as const;

function formatPlacedAt(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : dateFormatter.format(date);
}

export default function OrderPlacedScreen() {
  useStatusBarStyle('dark');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    orderNumber?: string;
    total?: string;
    placedAt?: string;
    address?: string;
    test?: string;
  }>();
  const isTest = params.test === '1';
  const total = params.total ? Number(params.total) : NaN;
  const placedAt = formatPlacedAt(params.placedAt);
  const [scale] = useState(() => new Animated.Value(0.4));

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 80,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [scale]);

  return (
    <View style={styles.screen}>
      <LinearGradient colors={BACKGROUND} style={StyleSheet.absoluteFill} />
      <View style={[styles.content, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.inner}>
          <View style={styles.hero} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            {CONFETTI.map((piece, index) => (
              <View
                key={index}
                style={[
                  styles.confetti,
                  {
                    top: piece.top,
                    left: 'left' in piece ? piece.left : undefined,
                    right: 'right' in piece ? piece.right : undefined,
                    backgroundColor: piece.color,
                    transform: [{ rotate: piece.rotate }],
                  },
                ]}
              />
            ))}
            <Animated.View style={[styles.badge, { transform: [{ scale }] }]}>
              <Ionicons name="checkmark" size={46} color={colors.white} />
            </Animated.View>
          </View>

          <Text style={styles.title} accessibilityRole="header">
            Order Placed Successfully!
          </Text>
          <Text style={styles.message}>Your order has been placed and will be processed shortly.</Text>

          {isTest ? (
            <View style={styles.testBanner} accessibilityRole="alert">
              <Ionicons name="flask-outline" size={18} color={colors.accent} />
              <Text style={styles.testText}>
                <Text style={styles.testTitle}>TEST ORDER. </Text>
                The store server is not connected, so nothing was sent to the store and no real order was created. It
                will not appear in My Orders.
              </Text>
            </View>
          ) : null}

          <View style={styles.card}>
            {params.orderNumber ? <DetailRow label="Order ID" value={`#${params.orderNumber}`} /> : null}
            {placedAt ? <DetailRow label="Placed on" value={placedAt} /> : null}
            {params.address ? <DetailRow label="Deliver to" value={params.address} /> : null}
            <DetailRow
              label="Payment"
              value={Number.isFinite(total) ? `Cash on delivery · ${formatPrice(total)}` : 'Cash on delivery'}
              last
            />
          </View>

          <View style={styles.actions}>
            <Button title="View Orders" icon="receipt-outline" onPress={() => router.replace('/orders')} />
            <Button title="Continue Shopping" variant="outline" onPress={() => router.replace('/home')} />
          </View>
        </View>
      </View>
    </View>
  );
}

function DetailRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowDivider]} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screen,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SCREEN_PADDING,
  },
  inner: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    alignItems: 'center',
  },
  hero: {
    width: '100%',
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  confetti: {
    position: 'absolute',
    width: 6,
    height: 12,
    borderRadius: 2,
    opacity: 0.85,
  },
  badge: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 44,
    backgroundColor: colors.success,
    borderWidth: 6,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    ...cardShadow,
  },
  title: {
    fontSize: 22,
    lineHeight: 30,
    fontFamily: fonts.bold,
    color: colors.navy,
    textAlign: 'center',
  },
  message: {
    marginTop: spacing.xs,
    maxWidth: 300,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    textAlign: 'center',
  },
  testBanner: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  testText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.regular,
    color: colors.navy,
  },
  testTitle: {
    fontFamily: fonts.bold,
    color: colors.accent,
  },
  card: {
    alignSelf: 'stretch',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    ...cardShadow,
  },
  row: {
    gap: 2,
    paddingVertical: spacing.md,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  rowLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  rowValue: {
    fontSize: 15,
    lineHeight: 21,
    fontFamily: fonts.semiBold,
    color: colors.navy,
  },
  actions: {
    alignSelf: 'stretch',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
});
