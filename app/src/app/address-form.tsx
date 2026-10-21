import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View, type TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { GLASS_HEADER_HEIGHT_ESTIMATE, GlassScreenHeader } from '@/components/ui/GlassScreenHeader';
import { TextField } from '@/components/ui/TextField';
import { MAX_CONTENT_WIDTH, SCREEN_PADDING, colors, fonts, radius, spacing, typography } from '@/constants/theme';
import { useStatusBarStyle } from '@/hooks/useStatusBarStyle';
import {
  ADDRESS_LABELS,
  deliverToAddress,
  getSavedAddress,
  saveAddress,
  type AddressLabel,
} from '@/state/locationStore';
import { validateAddressLine, validateCity, validatePincode } from '@/utils/validation';

export default function AddressFormScreen() {
  useStatusBarStyle('dark');
  const params = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [editing] = useState(() => (typeof params.id === 'string' ? getSavedAddress(params.id) : undefined));
  const cityRef = useRef<TextInput>(null);
  const pincodeRef = useRef<TextInput>(null);

  const [headerHeight, setHeaderHeight] = useState(insets.top + GLASS_HEADER_HEIGHT_ESTIMATE);
  const [label, setLabel] = useState<AddressLabel>(editing?.label ?? 'Home');
  const [line, setLine] = useState(editing?.line ?? '');
  const [city, setCity] = useState(editing?.city ?? '');
  const [pincode, setPincode] = useState(editing?.pincode ?? '');
  const [submitted, setSubmitted] = useState(false);

  const lineError = submitted ? validateAddressLine(line) : undefined;
  const cityError = submitted ? validateCity(city) : undefined;
  const pincodeError = submitted ? validatePincode(pincode) : undefined;

  const save = () => {
    setSubmitted(true);
    if (validateAddressLine(line) || validateCity(city) || validatePincode(pincode)) return;
    const saved = saveAddress({
      id: editing?.id,
      label,
      line: line.trim(),
      city: city.trim(),
      pincode: pincode.trim(),
    });
    // A newly added address is where the shopper wants delivery now.
    if (!editing) deliverToAddress(saved.id);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/delivery-location');
    }
  };

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: headerHeight + spacing.lg, paddingBottom: insets.bottom + spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.inner}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Save address as</Text>
              <View style={styles.chips} accessibilityRole="radiogroup">
                {ADDRESS_LABELS.map((option) => {
                  const active = option === label;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => setLabel(option)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Ionicons
                        name={option === 'Home' ? 'home-outline' : option === 'Office' ? 'business-outline' : 'location-outline'}
                        size={16}
                        color={active ? colors.white : colors.navy}
                      />
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <TextField
              label="House, building and street"
              placeholder="e.g. 123, Green Park"
              leftIcon="home-outline"
              value={line}
              onChangeText={setLine}
              error={lineError}
              autoCapitalize="words"
              autoComplete="street-address"
              textContentType="fullStreetAddress"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => cityRef.current?.focus()}
            />

            <TextField
              ref={cityRef}
              label="City or area"
              placeholder="e.g. Noida Sector 62"
              leftIcon="business-outline"
              value={city}
              onChangeText={setCity}
              error={cityError}
              autoCapitalize="words"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => pincodeRef.current?.focus()}
            />

            <TextField
              ref={pincodeRef}
              label="Pincode"
              placeholder="6-digit pincode"
              leftIcon="location-outline"
              value={pincode}
              onChangeText={(text) => setPincode(text.replace(/\D/g, '').slice(0, 6))}
              error={pincodeError}
              keyboardType="number-pad"
              maxLength={6}
              autoComplete="postal-code"
              textContentType="postalCode"
              returnKeyType="done"
              onSubmitEditing={save}
            />

            <Text style={styles.note}>Your addresses are saved on this device only.</Text>

            <Button title="Save Address" icon="checkmark" onPress={save} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <GlassScreenHeader
        title={editing ? 'Edit Address' : 'Add New Address'}
        fallback="/delivery-location"
        onHeightChange={setHeaderHeight}
      />
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
    gap: spacing.lg,
  },
  field: {
    gap: spacing.sm,
  },
  fieldLabel: {
    ...typography.label,
    color: colors.text,
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
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
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.semiBold,
    color: colors.navy,
  },
  chipTextActive: {
    color: colors.white,
  },
  note: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
