import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { MIN_TOUCH_TARGET, colors, fonts, noInputOutline, radius, spacing } from '@/constants/theme';

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
};

/** Browser speech recognition (Chrome, Edge, Safari); undefined on native and unsupported browsers. */
function getSpeechRecognition(): (new () => SpeechRecognitionLike) | undefined {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
  const scope = window as unknown as Record<string, (new () => SpeechRecognitionLike) | undefined>;
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
}

type ProductSearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: (query: string) => void;
  placeholder?: string;
  accessibilityLabel?: string;
  /** "soft" is a grey field; default is the boxed field. */
  shape?: 'box' | 'pill' | 'soft';
  /**
   * Shows a mic. On web it uses browser speech recognition; elsewhere it opens
   * the keyboard, whose own mic key handles voice typing.
   */
  voice?: boolean;
};

export function ProductSearchBar({
  value,
  onChangeText,
  onSubmit,
  placeholder = 'Search products, brands or materials',
  accessibilityLabel = 'Search products',
  shape = 'box',
  voice = false,
}: ProductSearchBarProps) {
  const inputRef = useRef<TextInput>(null);
  const [listening, setListening] = useState(false);

  const submit = () => {
    const query = value.trim();
    if (query) {
      onSubmit(query);
    } else {
      inputRef.current?.focus();
    }
  };

  const startVoice = () => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      inputRef.current?.focus();
      return;
    }
    const recognition = new Recognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript.trim() ?? '';
      if (!text) return;
      onChangeText(text);
      onSubmit(text);
    };
    recognition.onend = () => setListening(false);
    try {
      recognition.start();
      setListening(true);
    } catch {
      inputRef.current?.focus();
    }
  };

  return (
    <View
      style={[styles.container, shape === 'pill' && styles.containerPill, shape === 'soft' && styles.containerSoft]}
    >
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
      ) : voice ? (
        <Pressable
          onPress={startVoice}
          accessibilityRole="button"
          accessibilityLabel={listening ? 'Listening for your search' : 'Search by voice'}
          style={styles.iconButton}
        >
          <Ionicons name={listening ? 'mic' : 'mic-outline'} size={20} color={listening ? colors.orange : colors.textMuted} />
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
  containerSoft: {
    backgroundColor: colors.surface,
    borderColor: colors.surface,
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
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.text,
    paddingVertical: spacing.sm,
    ...noInputOutline,
  },
});
