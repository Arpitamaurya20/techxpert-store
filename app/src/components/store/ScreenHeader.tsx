import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/IconButton';
import { MAX_STORE_WIDTH, SCREEN_PADDING, colors, radius, spacing, typography } from '@/constants/theme';
import { useCartCount } from '@/state/cartStore';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  /** Usually a search bar, rendered under the title. */
  children?: ReactNode;
};

/** Navy tab-screen header matching the Home header: title, subtitle and a live cart button. */
export function ScreenHeader({ title, subtitle, children }: ScreenHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cartCount = useCartCount();

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.inner}>
        <View style={styles.topRow}>
          <View style={styles.titles}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          <View style={styles.actions}>
            <IconButton
              icon="cart-outline"
              accessibilityLabel="Cart"
              badgeCount={cartCount}
              onPress={() => router.navigate('/cart')}
            />
          </View>
        </View>

        {children ? <View style={styles.children}>{children}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.primary,
    paddingBottom: spacing.lg,
    paddingHorizontal: SCREEN_PADDING,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: MAX_STORE_WIDTH - SCREEN_PADDING * 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  titles: {
    flex: 1,
  },
  title: {
    ...typography.title,
    color: colors.white,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textOnDark,
  },
  actions: {
    marginRight: -spacing.sm,
  },
  children: {
    marginTop: spacing.md,
  },
});
