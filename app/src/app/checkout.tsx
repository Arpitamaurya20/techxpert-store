import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { GLASS_HEADER_HEIGHT_ESTIMATE, GlassScreenHeader } from '@/components/ui/GlassScreenHeader';
import { StateView } from '@/components/ui/StateView';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';
import { MAX_CONTENT_WIDTH, SCREEN_PADDING, cardShadow, colors, fonts, radius, spacing, typography } from '@/constants/theme';
import { useStatusBarStyle } from '@/hooks/useStatusBarStyle';
import { getErrorMessage } from '@/services/apiClient';
import { isApiConfigured } from '@/services/apiConfig';
import { placeOrder, type PaymentMethod } from '@/services/orderApi';
import { clearCart, useCartItems } from '@/state/cartStore';
import { locationStore, useSavedAddresses, type SavedAddress } from '@/state/locationStore';
import { useSession } from '@/state/sessionStore';
import { formatPrice, fromPaise, lineSubtotal, toPaise } from '@/utils/format';
import {
  normalizeIndianMobile,
  validateAddressLine,
  validateCity,
  validateFullName,
  validateMobile,
  validatePincode,
} from '@/utils/validation';

/**
 * Development builds without a store server run a labelled test checkout: nothing is sent to the
 * store and no order is created. Release builds never do this.
 */
const TEST_CHECKOUT = __DEV__;

/** Used until the bottom bar reports its real height. */
const BAR_HEIGHT_ESTIMATE = 88;

type PaymentOption = {
  id: PaymentMethod | 'UPI' | 'CARD';
  title: string;
  subtitle: string;
  available: boolean;
};

/** Only cash on delivery works until an online payment gateway is connected. */
const PAYMENT_OPTIONS: PaymentOption[] = [
  { id: 'COD', title: 'Cash on delivery', subtitle: 'Pay when your order arrives', available: true },
  { id: 'UPI', title: 'UPI', subtitle: 'GPay, PhonePe, Paytm', available: false },
  { id: 'CARD', title: 'Debit / credit card', subtitle: 'Visa, Mastercard, RuPay', available: false },
];

function defaultAddress() {
  const { addresses, defaultId, current } = locationStore.getState();
  const saved = addresses.find((address) => address.id === defaultId);
  return {
    line: saved?.line ?? '',
    city: saved?.city ?? current?.city ?? '',
    pincode: saved?.pincode ?? current?.pincode ?? '',
  };
}

export default function CheckoutScreen() {
  useStatusBarStyle('dark');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const items = useCartItems();
  const savedAddresses = useSavedAddresses();
  const user = useSession()?.user;
  const mobileRef = useRef<TextInput>(null);
  const lineRef = useRef<TextInput>(null);
  const cityRef = useRef<TextInput>(null);
  const pincodeRef = useRef<TextInput>(null);

  const [headerHeight, setHeaderHeight] = useState(insets.top + GLASS_HEADER_HEIGHT_ESTIMATE);
  const [barHeight, setBarHeight] = useState(BAR_HEIGHT_ESTIMATE);
  const [prefill] = useState(defaultAddress);
  const [name, setName] = useState(user?.name ?? '');
  const [mobile, setMobile] = useState(user?.mobile ?? '');
  const [line, setLine] = useState(prefill.line);
  const [city, setCity] = useState(prefill.city);
  const [pincode, setPincode] = useState(prefill.pincode);
  const [submitted, setSubmitted] = useState(false);
  const [placing, setPlacing] = useState(false);

  const errors = {
    name: validateFullName(name),
    mobile: validateMobile(mobile),
    line: validateAddressLine(line),
    city: validateCity(city),
    pincode: validatePincode(pincode),
  };
  const shown = (error: string | undefined) => (submitted ? error : undefined);
  const itemTotal = fromPaise(items.reduce((sum, item) => sum + toPaise(lineSubtotal(item.price, item.quantity)), 0));

  const applyAddress = (address: SavedAddress) => {
    setLine(address.line);
    setCity(address.city);
    setPincode(address.pincode);
  };

  const submit = async () => {
    if (placing) return;
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) {
      showToast({ variant: 'error', message: 'Please complete your delivery details.', bottomOffset: barHeight });
      return;
    }
    const address = `${line.trim()}, ${city.trim()} - ${pincode.trim()}`;
    if (!isApiConfigured) {
      if (TEST_CHECKOUT) {
        clearCart();
        router.replace({
          pathname: '/order-placed',
          params: {
            test: '1',
            orderNumber: `TEST-${Date.now().toString().slice(-6)}`,
            address,
            total: String(itemTotal),
            placedAt: new Date().toISOString(),
          },
        });
        return;
      }
      showToast({
        variant: 'error',
        message: "Online ordering isn't connected yet, so no order was placed. Your cart is unchanged.",
        bottomOffset: barHeight,
      });
      return;
    }

    setPlacing(true);
    try {
      const order = await placeOrder({
        items: items.map((item) => ({ productId: item.productId, quantity: item.quantity, unitPrice: item.price })),
        customerName: name.trim(),
        mobile: normalizeIndianMobile(mobile),
        address: { line: line.trim(), city: city.trim(), pincode: pincode.trim() },
        paymentMethod: 'COD',
      });
      clearCart();
      router.replace({
        pathname: '/order-placed',
        params: {
          orderNumber: order.orderNumber,
          address,
          ...(order.total !== undefined ? { total: String(order.total) } : {}),
          ...(order.placedAt ? { placedAt: order.placedAt } : {}),
        },
      });
    } catch (error) {
      showToast({ variant: 'error', message: getErrorMessage(error), bottomOffset: barHeight });
    } finally {
      setPlacing(false);
    }
  };

  const header = <GlassScreenHeader title="Checkout" fallback="/cart" onHeightChange={setHeaderHeight} />;

  if (items.length === 0) {
    return (
      <View style={[styles.screen, { paddingTop: headerHeight }]}>
        <StateView
          variant="empty"
          icon="cart-outline"
          title="Your cart is empty"
          message="Add products to your cart, then come back here to place your order."
          actionLabel="Browse Categories"
          onAction={() => router.navigate('/categories')}
        />
        {header}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: headerHeight + spacing.md, paddingBottom: barHeight + spacing.lg },
          ]}
          keyboardShouldPersistTaps="handled"
          scrollIndicatorInsets={{ top: headerHeight }}
        >
          <View style={styles.inner}>
            <Text style={styles.intro}>Review your details and place your order. You pay on delivery.</Text>

            <View style={styles.section}>
              <Text style={styles.sectionTitle} accessibilityRole="header">
                Delivery details
              </Text>

              {savedAddresses.length > 0 ? (
                <View style={styles.savedRow}>
                  <Text style={styles.savedLabel}>Use saved address</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                    {savedAddresses.map((address) => {
                      const active =
                        address.line === line.trim() && address.city === city.trim() && address.pincode === pincode.trim();
                      return (
                        <Pressable
                          key={address.id}
                          onPress={() => applyAddress(address)}
                          accessibilityRole="button"
                          accessibilityLabel={`Use ${address.label} address, ${address.line}, ${address.city}`}
                          accessibilityState={{ selected: active }}
                          style={[styles.chip, active && styles.chipActive]}
                        >
                          <Ionicons name="location-outline" size={14} color={active ? colors.white : colors.navy} />
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>{address.label}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}

              <TextField
                label="Full name"
                placeholder="Your name"
                leftIcon="person-outline"
                value={name}
                onChangeText={setName}
                error={shown(errors.name)}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => mobileRef.current?.focus()}
              />
              <TextField
                ref={mobileRef}
                label="Mobile number"
                placeholder="10-digit mobile number"
                leftIcon="call-outline"
                value={mobile}
                onChangeText={(text) => setMobile(text.replace(/[^\d+]/g, '').slice(0, 13))}
                error={shown(errors.mobile)}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => lineRef.current?.focus()}
              />
              <TextField
                ref={lineRef}
                label="Address"
                placeholder="House, building and street"
                leftIcon="home-outline"
                value={line}
                onChangeText={setLine}
                error={shown(errors.line)}
                autoCapitalize="words"
                autoComplete="street-address"
                textContentType="fullStreetAddress"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => cityRef.current?.focus()}
              />
              <View style={styles.row}>
                <View style={styles.rowItem}>
                  <TextField
                    ref={cityRef}
                    label="City"
                    placeholder="City or area"
                    value={city}
                    onChangeText={setCity}
                    error={shown(errors.city)}
                    autoCapitalize="words"
                    returnKeyType="next"
                    submitBehavior="submit"
                    onSubmitEditing={() => pincodeRef.current?.focus()}
                  />
                </View>
                <View style={styles.rowItem}>
                  <TextField
                    ref={pincodeRef}
                    label="Pin code"
                    placeholder="6 digits"
                    value={pincode}
                    onChangeText={(text) => setPincode(text.replace(/\D/g, '').slice(0, 6))}
                    error={shown(errors.pincode)}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoComplete="postal-code"
                    textContentType="postalCode"
                    returnKeyType="done"
                  />
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle} accessibilityRole="header">
                Payment
              </Text>
              <View accessibilityRole="radiogroup" style={styles.paymentList}>
                {PAYMENT_OPTIONS.map((option) => {
                  const selected = option.id === 'COD';
                  return (
                    <View
                      key={option.id}
                      accessible
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected, disabled: !option.available }}
                      accessibilityLabel={`${option.title}. ${option.subtitle}${option.available ? '' : '. Coming soon'}`}
                      style={[styles.payment, selected && styles.paymentSelected, !option.available && styles.paymentOff]}
                    >
                      <View style={[styles.radio, selected && styles.radioOn]}>
                        {selected ? <View style={styles.radioDot} /> : null}
                      </View>
                      <View style={styles.paymentText}>
                        <Text style={styles.paymentTitle}>{option.title}</Text>
                        <Text style={styles.paymentSubtitle}>{option.subtitle}</Text>
                      </View>
                      {option.available ? null : (
                        <View style={styles.soonPill}>
                          <Text style={styles.soonText}>Coming soon</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle} accessibilityRole="header">
                Order summary
              </Text>
              <View style={styles.summary}>
                {items.map((item) => (
                  <View key={item.productId} style={styles.summaryRow}>
                    <Text style={styles.summaryItem} numberOfLines={2}>
                      {item.name} × {item.quantity}
                    </Text>
                    <Text style={styles.summaryValue}>{formatPrice(lineSubtotal(item.price, item.quantity))}</Text>
                  </View>
                ))}
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryItem}>Delivery</Text>
                  <Text style={styles.summaryMuted}>Confirmed with your order</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.totalLabel}>Item total</Text>
                  <Text style={styles.totalValue}>{formatPrice(itemTotal)}</Text>
                </View>
              </View>
              <Text style={styles.note}>
                The store re-checks prices, stock and any delivery charge when your order is placed.
              </Text>
              {isApiConfigured ? null : (
                <View style={styles.notice}>
                  <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
                  <Text style={styles.noticeText}>
                    {TEST_CHECKOUT
                      ? 'TEST MODE: the store server is not connected, so Place order runs a test. Nothing is sent to the store and no real order is created.'
                      : 'Online ordering opens once the Techxpert store is connected. Until then no order can be placed.'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {header}

      <View
        style={[styles.bar, { paddingBottom: insets.bottom + spacing.md }]}
        onLayout={(event) => setBarHeight(Math.round(event.nativeEvent.layout.height))}
      >
        <View style={styles.barInner}>
          <Button
            title={`Place order · ${formatPrice(itemTotal)}`}
            loading={placing}
            loadingTitle="Placing order…"
            onPress={submit}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screen,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SCREEN_PADDING,
  },
  inner: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    gap: spacing.xl,
  },
  intro: {
    ...typography.caption,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: fonts.bold,
    color: colors.navy,
  },
  savedRow: {
    gap: spacing.xs,
  },
  savedLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  chips: {
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  chipActive: {
    borderColor: colors.navy,
    backgroundColor: colors.navy,
  },
  chipText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.semiBold,
    color: colors.navy,
  },
  chipTextActive: {
    color: colors.white,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rowItem: {
    flex: 1,
    minWidth: 0,
  },
  paymentList: {
    gap: spacing.sm,
  },
  payment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  paymentSelected: {
    borderColor: colors.navy,
    borderWidth: 1.5,
    backgroundColor: colors.navySoft,
  },
  paymentOff: {
    opacity: 0.6,
  },
  radio: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
  },
  radioOn: {
    borderColor: colors.navy,
  },
  radioDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.navy,
  },
  paymentText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  paymentTitle: {
    fontSize: 15,
    lineHeight: 21,
    fontFamily: fonts.semiBold,
    color: colors.navy,
  },
  paymentSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  soonPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  soonText: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: fonts.semiBold,
    color: colors.textMuted,
  },
  summary: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    ...cardShadow,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  summaryItem: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  summaryValue: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.semiBold,
    color: colors.navy,
  },
  summaryMuted: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  divider: {
    height: 1,
    marginVertical: spacing.xs,
    backgroundColor: colors.cardBorder,
  },
  totalLabel: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: fonts.bold,
    color: colors.navy,
  },
  totalValue: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: fonts.bold,
    color: colors.navy,
  },
  note: {
    ...typography.caption,
    color: colors.textMuted,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  noticeText: {
    ...typography.caption,
    flex: 1,
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
    maxWidth: MAX_CONTENT_WIDTH - SCREEN_PADDING * 2,
  },
});
