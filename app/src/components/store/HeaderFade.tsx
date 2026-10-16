import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/constants/theme';

type HeaderFadeProps = {
  /** More steps give a longer, softer blend. */
  steps?: number;
  stepHeight?: number;
  /** Higher values make the pink fall away faster. */
  falloff?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Pink strips that fade out below the store header, so the header blends into
 * the page instead of ending in a hard line. Built from plain views so it
 * looks the same on Android, iOS and web without a gradient library.
 */
export function HeaderFade({ steps = 16, stepHeight = 2, falloff = 2, style }: HeaderFadeProps) {
  return (
    <View style={style} pointerEvents="none">
      {Array.from({ length: steps }, (_, index) => (
        <View
          key={index}
          style={[styles.step, { height: stepHeight, opacity: (1 - index / steps) ** falloff }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  step: {
    backgroundColor: colors.homePink,
  },
});
