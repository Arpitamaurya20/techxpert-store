import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ComponentProps, type ReactNode, type Ref } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import {
  MIN_TOUCH_TARGET,
  colors,
  fonts,
  noInputOutline,
  radius,
  spacing,
  typography,
} from '@/constants/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
  leftIcon?: IconName;
  rightAccessory?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  ref?: Ref<TextInput>;
};

export function TextField({
  label,
  error,
  leftIcon,
  rightAccessory,
  containerStyle,
  editable = true,
  onFocus,
  onBlur,
  ref,
  ...inputProps
}: TextFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const hasError = Boolean(error);

  const iconColor = hasError ? colors.error : isFocused ? colors.accent : colors.textMuted;

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={styles.label}>{label}</Text>

      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.inputWrapperFocused,
          hasError && styles.inputWrapperError,
          !editable && styles.inputWrapperDisabled,
        ]}
      >
        {leftIcon ? (
          <Ionicons name={leftIcon} size={20} color={iconColor} style={styles.leftIcon} />
        ) : null}

        <TextInput
          ref={ref}
          style={styles.input}
          placeholderTextColor={colors.placeholder}
          editable={editable}
          accessibilityLabel={label}
          accessibilityHint={error}
          aria-invalid={hasError}
          onFocus={(event) => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
          {...inputProps}
        />

        {rightAccessory}
      </View>

      {hasError ? (
        <View style={styles.errorRow} accessibilityLiveRegion="polite" accessibilityRole="alert">
          <Ionicons name="alert-circle" size={15} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
    color: colors.text,
  },
  inputWrapper: {
    minHeight: MIN_TOUCH_TARGET + 4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  inputWrapperFocused: {
    borderColor: colors.accent,
    backgroundColor: colors.background,
  },
  inputWrapperError: {
    borderColor: colors.error,
    backgroundColor: colors.background,
  },
  inputWrapperDisabled: {
    opacity: 0.6,
  },
  leftIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    alignSelf: 'stretch',
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.text,
    paddingVertical: spacing.md,
    ...noInputOutline,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  errorText: {
    ...typography.caption,
    flex: 1,
    color: colors.error,
  },
});
