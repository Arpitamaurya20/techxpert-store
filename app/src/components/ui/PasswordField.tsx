import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { MIN_TOUCH_TARGET, colors } from '@/constants/theme';

import { TextField, type TextFieldProps } from './TextField';

type PasswordFieldProps = Omit<TextFieldProps, 'secureTextEntry' | 'rightAccessory'>;

export function PasswordField({ editable = true, ...props }: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <TextField
      leftIcon="lock-closed-outline"
      autoCapitalize="none"
      autoCorrect={false}
      spellCheck={false}
      {...props}
      editable={editable}
      secureTextEntry={!isVisible}
      rightAccessory={
        <Pressable
          onPress={() => setIsVisible((visible) => !visible)}
          disabled={!editable}
          accessibilityRole="button"
          accessibilityLabel={isVisible ? 'Hide password' : 'Show password'}
          hitSlop={4}
          style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}
        >
          <Ionicons
            name={isVisible ? 'eye-off-outline' : 'eye-outline'}
            size={22}
            color={colors.textMuted}
          />
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
  toggle: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    marginRight: -8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  togglePressed: {
    opacity: 0.6,
  },
});
