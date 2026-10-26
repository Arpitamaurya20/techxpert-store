import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SCREEN_PADDING, colors, fonts, radius, spacing } from '@/constants/theme';
import { SEARCH_SUGGESTIONS } from '@/data/homeContent';
import { addRecentSearch, clearRecentSearches, useRecentSearches } from '@/state/searchHistoryStore';

type SearchSuggestionsProps = {
  /** Published ideas. Leave this out to use the app's own list. An empty list draws no extra chips. */
  published?: string[];
};

/** The customer's recent searches first, then search ideas, as one swipeable row of chips. */
export function SearchSuggestions({ published }: SearchSuggestionsProps) {
  const router = useRouter();
  const recent = useRecentSearches();
  const source = published ?? SEARCH_SUGGESTIONS;
  const ideas = source.filter((idea) => !recent.some((item) => item.toLowerCase() === idea.toLowerCase()));

  if (recent.length === 0 && ideas.length === 0) return null;

  const search = (query: string) => {
    addRecentSearch(query);
    router.push({ pathname: '/products', params: { search: query } });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{recent.length > 0 ? 'Recent searches' : 'Try searching'}</Text>
        {recent.length > 0 ? (
          <Pressable
            onPress={clearRecentSearches}
            accessibilityRole="button"
            accessibilityLabel="Clear recent searches"
            hitSlop={8}
          >
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroller}
        contentContainerStyle={styles.row}
      >
        {recent.map((item) => (
          <Chip key={`recent-${item}`} label={item} icon="time-outline" onPress={() => search(item)} />
        ))}
        {ideas.map((item) => (
          <Chip key={`idea-${item}`} label={item} icon="trending-up" onPress={() => search(item)} />
        ))}
      </ScrollView>
    </View>
  );
}

type ChipProps = {
  label: string;
  icon: 'time-outline' | 'trending-up';
  onPress: () => void;
};

function Chip({ label, icon, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Search ${label}`}
      style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
    >
      <Ionicons name={icon} size={13} color={colors.textMuted} />
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.semiBold,
    color: colors.textMuted,
  },
  clear: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.semiBold,
    color: colors.accent,
  },
  scroller: {
    flexGrow: 0,
    marginHorizontal: -SCREEN_PADDING,
  },
  row: {
    gap: spacing.sm,
    paddingHorizontal: SCREEN_PADDING,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 32,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  chipPressed: {
    backgroundColor: colors.navySoft,
  },
  chipText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.medium,
    color: colors.navy,
  },
});
