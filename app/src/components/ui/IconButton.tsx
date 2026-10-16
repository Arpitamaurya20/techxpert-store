import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MIN_TOUCH_TARGET, colors, fonts } from '@/constants/theme';

import type { IconName } from './TextField';

type IconButtonProps = {
  icon: IconName;
  accessibilityLabel: string;
  onPress: () => void;
  badgeCount?: number;
  /** "dark" for navy headers, "light" for white/grey, "filled" for a white circle on pink. */
  surface?: 'dark' | 'light' | 'filled';
};

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  badgeCount = 0,
  surface = 'dark',
}: IconButtonProps) {
  const badgeText = badgeCount > 99 ? '99+' : String(badgeCount);
  const onLight = surface === 'light';
  const filled = surface === 'filled';
  const iconColor = filled || onLight ? colors.homeInk : colors.white;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        badgeCount > 0 ? `${accessibilityLabel}, ${badgeCount} items` : accessibilityLabel
      }
      style={({ pressed }) => [
        styles.button,
        filled && styles.filled,
        pressed && (filled || onLight ? styles.pressedOnLight : styles.pressed),
      ]}
    >
      <Ionicons name={icon} size={22} color={iconColor} />
      {badgeCount > 0 ? (
        <View style={[styles.badge, (onLight || filled) && styles.badgeOnLight, filled && styles.badgeFilled]}>
          <Text style={styles.badgeText}>{badgeText}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: MIN_TOUCH_TARGET / 2,
  },
  pressed: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  filled: {
    backgroundColor: colors.white,
  },
  pressedOnLight: {
    backgroundColor: 'rgba(16,42,67,0.08)',
  },
  badgeFilled: {
    backgroundColor: colors.accent,
    borderColor: colors.white,
    top: 2,
    right: 2,
  },
  badgeOnLight: {
    borderColor: colors.surface,
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 14,
    fontFamily: fonts.semiBold,
    color: colors.white,
  },
});
