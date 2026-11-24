import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';

import { Button } from '@/components/ui/Button';
import { StateView } from '@/components/ui/StateView';
import { colors, fonts, spacing, typography } from '@/constants/theme';
import { useStatusBarStyle } from '@/hooks/useStatusBarStyle';
import { ApiError, getErrorMessage } from '@/services/apiClient';
import {
  getOrderPaymentSnapshot,
  initiatePayuPayment,
  isPayuReturnUrl,
  verifyPayuPayment,
} from '@/services/paymentApi';

type Phase = 'loading' | 'webview' | 'verifying' | 'error';

/**
 * PayU WebView after checkout with paymentMethod PayU (docs/APP_TEAM_PULL_BRIEF.md §E).
 * On return (or app resume), verify then route to order-placed or stay for retry.
 */
export default function PayuCheckoutScreen() {
  useStatusBarStyle('dark');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    orderId?: string;
    orderNumber?: string;
    total?: string;
    address?: string;
  }>();
  const orderId = params.orderId ?? '';
  const [phase, setPhase] = useState<Phase>('loading');
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const finishing = useRef(false);

  const finishPaid = useCallback(
    async (snapshotOrderNumber?: string, snapshotTotal?: number, placedAt?: string) => {
      router.replace({
        pathname: '/order-placed',
        params: {
          orderNumber: snapshotOrderNumber ?? params.orderNumber ?? orderId,
          ...(snapshotTotal !== undefined
            ? { total: String(snapshotTotal) }
            : params.total
              ? { total: params.total }
              : {}),
          ...(placedAt ? { placedAt } : {}),
          ...(params.address ? { address: params.address } : {}),
          payment: 'paid',
        },
      });
    },
    [orderId, params.address, params.orderNumber, params.total, router]
  );

  const reconcile = useCallback(async () => {
    if (!orderId || finishing.current) return;
    finishing.current = true;
    setPhase('verifying');
    try {
      const snapshot = await verifyPayuPayment(orderId);
      if (snapshot.paymentStatus === 'paid') {
        await finishPaid(snapshot.orderNumber, snapshot.total, snapshot.placedAt);
        return;
      }
      if (snapshot.paymentStatus === 'failed') {
        setError('Payment did not go through. You can try again or place a new order with cash on delivery.');
        setPhase('error');
        finishing.current = false;
        return;
      }
      // Still pending — show retry / leave options
      setError('Payment is still pending. If you completed UPI, tap Check payment status.');
      setPhase('error');
      finishing.current = false;
    } catch (err) {
      setError(getErrorMessage(err));
      setPhase('error');
      finishing.current = false;
    }
  }, [finishPaid, orderId]);

  const startPayu = useCallback(async () => {
    if (!orderId) {
      setError('Missing order. Go back to checkout and place the order again.');
      setPhase('error');
      return;
    }
    finishing.current = false;
    setPhase('loading');
    setError(null);
    try {
      const existing = await getOrderPaymentSnapshot(orderId);
      if (existing.paymentStatus === 'paid') {
        await finishPaid(existing.orderNumber, existing.total, existing.placedAt);
        return;
      }
      const initiated = await initiatePayuPayment(orderId);
      if (!initiated.checkoutHtml) {
        setError('Online payment did not return a PayU page.');
        setPhase('error');
        return;
      }
      setHtml(initiated.checkoutHtml);
      setPhase('webview');
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 503
          ? 'Online payment is not configured on the server yet. Use cash on delivery, or try again later.'
          : getErrorMessage(err);
      setError(message);
      setPhase('error');
    }
  }, [finishPaid, orderId]);

  useEffect(() => {
    // Defer so the effect body does not setState synchronously (lint react-hooks/set-state-in-effect).
    const handle = setTimeout(() => {
      void startPayu();
    }, 0);
    return () => clearTimeout(handle);
  }, [startPayu]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && phase === 'webview') {
        void reconcile();
      }
    });
    return () => sub.remove();
  }, [phase, reconcile]);

  const onNav = (nav: WebViewNavigation) => {
    if (!nav.url || finishing.current) return;
    const kind = isPayuReturnUrl(nav.url);
    if (kind) void reconcile();
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ title: 'Pay online', headerBackVisible: phase !== 'verifying' }} />

      {phase === 'loading' || phase === 'verifying' ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.status}>
            {phase === 'verifying' ? 'Confirming payment…' : 'Starting secure payment…'}
          </Text>
        </View>
      ) : null}

      {phase === 'error' ? (
        <View style={styles.center}>
          <StateView
            variant="error"
            title="Payment not complete"
            message={error ?? 'Something went wrong with online payment.'}
            actionLabel="Try PayU again"
            onAction={() => void startPayu()}
          />
          <View style={styles.actions}>
            <Button title="Check payment status" onPress={() => void reconcile()} />
            <Button title="Back to cart" variant="outline" onPress={() => router.replace('/cart')} />
          </View>
        </View>
      ) : null}

      {phase === 'webview' && html ? (
        Platform.OS === 'web' ? (
          <View style={styles.center}>
            <Text style={styles.status}>
              Complete payment in the PayU window. When you finish, return here and tap Check payment status.
            </Text>
            <Button
              title="Open PayU"
              onPress={() => {
                const blob = new Blob([html], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank', 'noopener,noreferrer');
              }}
            />
            <Button title="Check payment status" variant="outline" onPress={() => void reconcile()} />
          </View>
        ) : (
          <WebView
            originWhitelist={['*']}
            source={{ html }}
            onNavigationStateChange={onNav}
            startInLoadingState
            style={styles.webview}
            setSupportMultipleWindows={false}
          />
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  status: {
    ...typography.body,
    fontFamily: fonts.medium,
    color: colors.navy,
    textAlign: 'center',
  },
  webview: {
    flex: 1,
  },
  actions: {
    gap: spacing.md,
  },
});
