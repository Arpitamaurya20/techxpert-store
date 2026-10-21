import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet } from 'react-native';

/** Neutral frosted-glass wash: bright at the top, a touch of grey at the bottom edge. */
const GLASS_GRADIENT = ['rgba(255, 255, 255, 0.92)', 'rgba(244, 245, 247, 0.78)'] as const;

/** Hairline colour for glass edges and glass buttons. */
export const GLASS_EDGE = 'rgba(15, 23, 42, 0.1)';

/** Container styles that pair with `GlassBackground`: translucent base, hairline edge and a soft neutral shadow. */
export const glassSurface = {
  backgroundColor: 'rgba(255, 255, 255, 0.55)',
  borderBottomWidth: StyleSheet.hairlineWidth,
  borderBottomColor: GLASS_EDGE,
  ...Platform.select({
    web: { boxShadow: '0px 6px 18px rgba(15, 23, 42, 0.07)' },
    default: {
      shadowColor: '#0F172A',
      shadowOpacity: 0.07,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
  }),
} as const;

/** Blur plus neutral gradient; render as the first child of a header so content scrolling underneath is frosted. */
export function GlassBackground() {
  return (
    <>
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
      <LinearGradient colors={GLASS_GRADIENT} style={StyleSheet.absoluteFill} pointerEvents="none" />
    </>
  );
}
