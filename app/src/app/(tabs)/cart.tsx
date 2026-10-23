import { Tabs, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CartItemCard } from '@/components/store/CartItemCard';
import { CartOrderSummary } from '@/components/store/CartOrderSummary';
import { DemoDataNotice } from '@/components/store/DemoDataNotice';
import { Button } from '@/components/ui/Button';
import { StateView } from '@/components/ui/StateView';
import { MAX_STORE_WIDTH, SCREEN_PADDING, colors, fonts, spacing, typography } from '@/constants/theme';
import { isApiConfigured } from '@/services/apiConfig';
import {
  refreshCart,
  useCanCheckout,
  useCartCount,
  useCartItems,
  useCartLineCount,
  useCartTotals,
} from '@/state/cartStore';
import { formatPrice, fromPaise, toPaise } from '@/utils/format';

const CHECKOUT_BAR_ESTIMATE = 96;

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const items = useCartItems();
  const itemCount = useCartCount();
  const lineCount = useCartLineCount();
  const totals = useCartTotals();
  const canCheckout = useCanCheckout();
  const [barHeight, setBarHeight] = useState(CHECKOUT_BAR_ESTIMATE);
  const checkoutLock = useRef(false);

  useFocusEffect(
    useCallback(() => {
      checkoutLock.current = false;
      void refreshCart();
    }, [])
  );

  const hasProblem = items.some((item) => item.problem);
  const subtotal =
    totals?.subtotal ??
    fromPaise(
      items.filter((item) => !item.problem).reduce((sum, item) => sum + toPaise(item.price) * item.quantity, 0)
    );
  const productWord = lineCount === 1 ? 'product' : 'products';
  const subtitle =
    lineCount === 0
      ? undefined
      : lineCount === itemCount
        ? `${lineCount} ${productWord}`
        : `${lineCount} ${productWord} · ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;

  const continueShopping = () => router.navigate('/home');

  const goToCheckout = () => {
    if (checkoutLock.current || items.length === 0 || !canCheckout) return;
    checkoutLock.current = true;
    router.push('/checkout');
  };

  const header = (
    <Tabs.Screen
      options={{
        title: 'My Cart',
        headerRight: () => (
          <Pressable
            onPress={continueShopping}
            accessibilityRole="button"
            accessibilityLabel="Continue shopping"
            hitSlop={8}
            style={({ pressed }) => [styles.headerLink, pressed && styles.headerLinkPressed]}
          >
            <Text style={styles.headerLinkText}>Continue Shopping</Text>
          </Pressable>
        ),
      }}
    />
  );

  if (items.length === 0) {
    return (
      <>
        {header}
        <StateView
          variant="empty"
          icon="cart-outline"
          title="Your cart is empty"
          message="Explore our store and add products to your cart."
          actionLabel="Continue Shopping"
          onAction={continueShopping}
        />
      </>
    );
  }

  return (
    <>
      {header}
      <View style={styles.screen}>
        <FlatList
          data={items}
          keyExtractor={(item) => item.productId}
          renderItem={({ item }) => <CartItemCard item={item} />}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              {subtitle ? <Text style={styles.count}>{subtitle}</Text> : null}
              {!isApiConfigured ? (
                <DemoDataNotice message="This cart is stored on this device only. It is cleared if you close the app, and it is not saved to a Techxpert account." />
              ) : null}
            </View>
          }
          ListFooterComponent={
            <CartOrderSummary
              subtotal={subtotal}
              itemCount={itemCount}
              lineCount={lineCount}
              totals={totals}
              connected={isApiConfigured}
            />
          }
          contentContainerStyle={[styles.content, { paddingBottom: barHeight + spacing.lg }]}
        />

        <View
          style={[styles.bar, { paddingBottom: insets.bottom + spacing.md }]}
          onLayout={(event) => setBarHeight(Math.round(event.nativeEvent.layout.height))}
        >
          <View style={styles.barInner}>
            <View
              accessible
              accessibilityLabel={`${totals ? 'Total' : 'Subtotal'} ${formatPrice(totals?.grandTotal ?? subtotal)}`}
            >
              <Text style={styles.barLabel}>{totals ? 'Total' : 'Subtotal'}</Text>
              <Text style={styles.barValue}>{formatPrice(totals?.grandTotal ?? subtotal)}</Text>
            </View>
            <View style={styles.barButton}>
              <Button
                title={hasProblem ? 'Fix items to continue' : 'Proceed to Checkout'}
                icon="arrow-forward"
                onPress={goToCheckout}
                disabled={!canCheckout}
                accessibilityHint={
                  hasProblem
                    ? 'Some items cannot be ordered as they are. Change or remove them first.'
                    : 'Opens checkout to enter your delivery details and place the order'
                }
              />
            </View>
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screen,
  },
  headerLink: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    marginRight: spacing.xs,
    borderRadius: 8,
  },
  headerLinkPressed: {
    backgroundColor: colors.surface,
  },
  headerLinkText: {
    ...typography.label,
    color: colors.accent,
  },
  content: {
    width: '100%',
    maxWidth: MAX_STORE_WIDTH,
    alignSelf: 'center',
    padding: SCREEN_PADDING,
    gap: spacing.md,
  },
  listHeader: {
    gap: spacing.md,
  },
  count: {
    ...typography.caption,
    color: colors.textMuted,
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing.md,
    paddingHorizontal: SCREEN_PADDING,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    alignItems: 'center',
  },
  barInner: {
    width: '100%',
    maxWidth: MAX_STORE_WIDTH - SCREEN_PADDING * 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  barLabel: {
    ...typography.small,
    color: colors.textMuted,
  },
  barValue: {
    ...typography.sectionTitle,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  barButton: {
    flex: 1,
    maxWidth: 420,
  },
});
