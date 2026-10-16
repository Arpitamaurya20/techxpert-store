import Ionicons from '@expo/vector-icons/Ionicons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { HeaderBackFallback } from '@/components/ui/HeaderBackFallback';
import { CURRENT_LANGUAGE, LANGUAGES } from '@/constants/languages';
import { MAX_CONTENT_WIDTH, SCREEN_PADDING, colors, fonts, radius, spacing } from '@/constants/theme';
import { useStatusBarStyle } from '@/hooks/useStatusBarStyle';

export default function LanguageScreen() {
  useStatusBarStyle('dark');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <HeaderBackFallback fallback="/profile" accessibilityLabel="Back to settings" />
      <Text style={styles.intro}>Choose the language for the app.</Text>

      <View style={styles.list} accessibilityRole="radiogroup">
        {LANGUAGES.map((language, index) => {
          const selected = language.code === CURRENT_LANGUAGE.code;
          return (
            <View
              key={language.code}
              accessible
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled: !language.available }}
              accessibilityLabel={
                language.available ? language.label : `${language.label}, coming soon`
              }
              style={[styles.row, index < LANGUAGES.length - 1 && styles.divider]}
            >
              <View style={styles.text}>
                <Text style={[styles.label, !language.available && styles.labelDisabled]}>
                  {language.label}
                </Text>
                {language.nativeLabel ? (
                  <Text style={styles.native}>{language.nativeLabel}</Text>
                ) : null}
              </View>
              {language.available ? (
                <Ionicons
                  name={selected ? 'radio-button-on' : 'radio-button-off'}
                  size={22}
                  color={selected ? colors.accent : colors.textMuted}
                />
              ) : (
                <View style={styles.soonPill}>
                  <Text style={styles.soonText}>Coming soon</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    padding: SCREEN_PADDING + spacing.xs,
    gap: spacing.lg,
  },
  intro: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  list: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 64,
    paddingVertical: spacing.md,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: fonts.medium,
    color: colors.homeInk,
  },
  labelDisabled: {
    color: colors.textMuted,
  },
  native: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  soonPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  soonText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.semiBold,
    color: colors.textMuted,
  },
});
