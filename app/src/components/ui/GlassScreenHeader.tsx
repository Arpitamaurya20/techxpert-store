import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MAX_CONTENT_WIDTH, SCREEN_PADDING, colors, fonts, spacing } from '@/constants/theme';

import { GLASS_EDGE, GlassBackground, glassSurface } from './GlassBackground';

/** Used until the header reports its real height. */
export const GLASS_HEADER_HEIGHT_ESTIMATE = 64;

type GlassScreenHeaderProps = {
  title: string;
  /** Where the back arrow goes when there is no screen to go back to. */
  fallback: Href;
  right?: ReactNode;
  /** Reports the full height so the screen can pad its content underneath. */
  onHeightChange: (height: number) => void;
};

/**
 * Frosted page header that floats over the screen's content.
 * The screen must hide the stack header and pad its scroll content by the reported height.
 */
export function GlassScreenHeader({ title, fallback, right, onHeightChange }: GlassScreenHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate(fallback);
    }
  };

  return (
    <View
      style={[styles.header, { paddingTop: insets.top + spacing.sm }]}
      onLayout={(event) => onHeightChange(Math.round(event.nativeEvent.layout.height))}
    >
      <GlassBackground />
      <View style={styles.inner}>
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={4}
          style={({ pressed }) => [styles.backButton, pressed && styles.backPressed]}
        >
          <Ionicons name="arrow-back" size={21} color={colors.navy} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: spacing.md,
    ...glassSurface,
  },
  inner: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1,
    borderColor: GLASS_EDGE,
  },
  backPressed: {
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
  },
  title: {
    flex: 1,
    fontSize: 20,
    lineHeight: 28,
    fontFamily: fonts.bold,
    color: colors.navy,
  },
});
