import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { MAX_CONTENT_WIDTH, SCREEN_PADDING, colors, spacing, typography } from '@/constants/theme';
import { setDeliveryLocation, useDeliveryLocation } from '@/state/locationStore';
import { validateCity, validatePincode } from '@/utils/validation';

export default function DeliveryLocationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const current = useDeliveryLocation();
  const cityRef = useRef<TextInput>(null);

  const [pincode, setPincode] = useState(current?.pincode ?? '');
  const [city, setCity] = useState(current?.city ?? '');
  const [submitted, setSubmitted] = useState(false);

  const pincodeError = submitted ? validatePincode(pincode) : undefined;
  const cityError = submitted ? validateCity(city) : undefined;

  const save = () => {
    setSubmitted(true);
    if (validatePincode(pincode) || validateCity(city)) return;
    setDeliveryLocation({ pincode: pincode.trim(), city: city.trim() });
    router.back();
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.inner}>
          <Text style={styles.intro}>
            Enter where you want your order delivered. It is kept on this device until you close the
            app.
          </Text>

          <TextField
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
            returnKeyType="done"
            onSubmitEditing={save}
          />

          <Button title="Save Location" icon="checkmark" onPress={save} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: SCREEN_PADDING,
  },
  inner: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    gap: spacing.lg,
  },
  intro: {
    ...typography.body,
    color: colors.textMuted,
  },
});
