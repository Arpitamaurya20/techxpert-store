import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { MIN_TOUCH_TARGET, colors, fonts, noInputOutline, radius, spacing } from '@/constants/theme';

type ProductSearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: (query: string) => void;
  placeholder?: string;
  accessibilityLabel?: string;
  /** Pill matches the Home header; default is the boxed listing field. */
  shape?: 'box' | 'pill';
};

export function ProductSearchBar({
  value,
  onChangeText,
  onSubmit,
  placeholder = 'Search products, brands or materials',
  accessibilityLabel = 'Search products',
  shape = 'box',
}: ProductSearchBarProps) {
  const inputRef = useRef<TextInput>(null);

  const submit = () => {
    const query = value.trim();
    if (query) {
      onSubmit(query);
    } else {
      inputRef.current?.focus();
    }
  };

  return (
    <View style={[styles.container, shape === 'pill' && styles.containerPill]}>
      <Pressable
        onPress={submit}
        accessibilityRole="button"
        accessibilityLabel="Search"
        style={styles.iconButton}
      >
        <Ionicons name="search" size={20} color={colors.textMuted} />
      </Pressable>

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={submit}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={accessibilityLabel}
        style={styles.input}
      />

      {value.length > 0 ? (
        <Pressable
          onPress={() => {
            onChangeText('');
            inputRef.current?.focus();
          }}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          style={styles.iconButton}
        >
          <Ionicons name="close-circle" size={20} color={colors.placeholder} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  containerPill: {
    borderRadius: radius.pill,
    borderWidth: 0,
    minHeight: 48,
    ...Platform.select({
      web: { boxShadow: '0px 4px 12px rgba(28, 20, 18, 0.08)' },
      default: {
        shadowColor: '#1C1412',
        shadowOpacity: 0.1,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 3,
      },
    }),
  },
  iconButton: {
    width: 44,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    alignSelf: 'stretch',
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.text,
    paddingVertical: spacing.sm,
    ...noInputOutline,
  },
});
