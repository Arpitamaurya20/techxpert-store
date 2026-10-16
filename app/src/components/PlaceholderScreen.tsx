import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import type { IconName } from '@/components/ui/TextField';
import { MAX_CONTENT_WIDTH, colors, fonts, radius, spacing, typography } from '@/constants/theme';

type PlaceholderScreenProps = {
  icon: IconName;
  title: string;
  message: string;
  withSafeAreaTop?: boolean;
  /** Replaces the default "Back to Sign In" button. */
  action?: { label: string; icon: IconName; onPress: () => void };
};

export function PlaceholderScreen({
  icon,
  title,
  message,
  withSafeAreaTop = false,
  action,
}: PlaceholderScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const goToLogin = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/login');
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: (withSafeAreaTop ? insets.top : 0) + spacing.xxl,
          paddingBottom: insets.bottom + spacing.xxl,
        },
      ]}
    >
      <StatusBar style="dark" />
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name={icon} size={36} color={colors.accent} />
        </View>

        <View style={styles.badge}>
          <Text style={styles.badgeText}>COMING SOON</Text>
        </View>

        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.message}>{message}</Text>

        <View style={styles.action}>
          {action ? (
            <Button title={action.label} variant="outline" icon={action.icon} onPress={action.onPress} />
          ) : (
            <Button title="Back to Sign In" variant="outline" icon="arrow-back" onPress={goToLogin} />
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    letterSpacing: 1.5,
    color: colors.textMuted,
  },
  title: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  action: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
  },
});
