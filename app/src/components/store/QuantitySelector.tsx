import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MIN_TOUCH_TARGET, colors, radius, typography } from '@/constants/theme';

type QuantitySelectorProps = {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  /** Used in labels, e.g. "Decrease quantity of LED Bulb". */
  itemName: string;
};

export function QuantitySelector({
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled = false,
  itemName,
}: QuantitySelectorProps) {
  const canDecrease = !disabled && value - step >= min;
  const canIncrease = !disabled && value + step <= max;

  return (
    <View
      style={[styles.stepper, disabled && styles.stepperDisabled]}
      accessibilityLabel={`Quantity for ${itemName}`}
    >
      <StepButton
        icon="remove"
        label={`Decrease quantity of ${itemName}`}
        disabled={!canDecrease}
        onPress={() => onChange(value - step)}
      />
      <Text
        style={[styles.value, disabled && styles.valueDisabled]}
        accessibilityLabel={`Quantity ${value}`}
        accessibilityLiveRegion="polite"
      >
        {value}
      </Text>
      <StepButton
        icon="add"
        label={`Increase quantity of ${itemName}`}
        disabled={!canIncrease}
        onPress={() => onChange(value + step)}
      />
    </View>
  );
}

type StepButtonProps = {
  icon: 'add' | 'remove';
  label: string;
  disabled: boolean;
  onPress: () => void;
};

function StepButton({ icon, label, disabled, onPress }: StepButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={20} color={disabled ? colors.disabled : colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  stepperDisabled: {
    backgroundColor: colors.surface,
  },
  button: {
    width: MIN_TOUCH_TARGET - 4,
    height: MIN_TOUCH_TARGET + 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  pressed: {
    backgroundColor: colors.surface,
  },
  value: {
    ...typography.button,
    minWidth: 32,
    textAlign: 'center',
    color: colors.text,
  },
  valueDisabled: {
    color: colors.textMuted,
  },
});
