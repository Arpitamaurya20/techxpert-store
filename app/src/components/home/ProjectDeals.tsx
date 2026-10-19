import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, spacing } from '@/constants/theme';
import { PROJECT_DEALS } from '@/data/homeContent';
import type { Category } from '@/types/catalog';

import { SectionHeader } from './SectionHeader';

type ProjectDealsProps = {
  categories: Category[];
  /** Sample offer text is only shown alongside the sample catalogue. */
  showSampleOffers: boolean;
  onOpenCategory: (category: Category) => void;
  onViewAll: () => void;
};

export function ProjectDeals({ categories, showSampleOffers, onOpenCategory, onViewAll }: ProjectDealsProps) {
  const deals = PROJECT_DEALS.flatMap((deal) => {
    const category = categories.find((item) => item.id === deal.categoryId);
    return category ? [{ ...deal, category }] : [];
  });

  if (deals.length === 0) return null;

  return (
    <View style={styles.section}>
      <SectionHeader title="Deals for You" actionLabel="View all" onAction={onViewAll} />
      <View style={styles.row}>
        {deals.map((deal) => {
          const navy = deal.tone === 'navy';
          const offer = showSampleOffers ? deal.sampleOffer : deal.tagline;
          return (
            <Pressable
              key={deal.categoryId}
              onPress={() => onOpenCategory(deal.category)}
              accessibilityRole="button"
              accessibilityLabel={`${deal.title}${deal.highlight ? ` ${deal.highlight}` : ''}. ${offer}${
                showSampleOffers ? ' (sample offer)' : ''
              }. Shop now`}
              style={({ pressed }) => [styles.card, navy ? styles.cardNavy : styles.cardPeach, pressed && styles.pressed]}
            >
              <View style={styles.art}>
                <Image source={deal.image} style={styles.image} contentFit="cover" accessible={false} />
              </View>
              {showSampleOffers ? (
                <View style={styles.sampleTag}>
                  <Text style={styles.sampleTagText}>SAMPLE</Text>
                </View>
              ) : null}

              <View style={styles.copy}>
                <Text style={[navy ? styles.titleOnNavy : styles.title]} numberOfLines={1}>
                  {deal.title}
                </Text>
                {deal.highlight ? (
                  <Text style={styles.title} numberOfLines={1}>
                    {deal.highlight}
                  </Text>
                ) : null}
                <Text
                  style={[
                    showSampleOffers ? styles.offer : styles.tagline,
                    navy ? styles.offerOnNavy : styles.offerOnPeach,
                  ]}
                  numberOfLines={2}
                >
                  {offer}
                </Text>
              </View>
              <View style={styles.cta}>
                <Text style={styles.ctaText}>Shop Now</Text>
                <Ionicons name="arrow-forward" size={11} color={colors.white} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  card: {
    flex: 1,
    height: 132,
    justifyContent: 'space-between',
    padding: spacing.md,
    overflow: 'hidden',
    borderRadius: radius.md,
  },
  cardPeach: {
    backgroundColor: '#FDE2CC',
  },
  cardNavy: {
    backgroundColor: '#1F4FA3',
  },
  pressed: {
    opacity: 0.88,
  },
  art: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 58,
    height: 58,
    overflow: 'hidden',
    borderRadius: radius.sm,
    backgroundColor: colors.white,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  sampleTag: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: colors.warningSoft,
  },
  sampleTagText: {
    fontSize: 7,
    lineHeight: 10,
    letterSpacing: 0.5,
    fontFamily: fonts.bold,
    color: colors.warning,
  },
  copy: {
    paddingRight: spacing.lg,
  },
  title: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: fonts.bold,
    color: colors.navy,
  },
  titleOnNavy: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.semiBold,
    color: colors.white,
  },
  offer: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 18,
    fontFamily: fonts.bold,
  },
  tagline: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 15,
    fontFamily: fonts.semiBold,
  },
  offerOnPeach: {
    color: colors.orange,
  },
  offerOnNavy: {
    color: colors.white,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.orange,
  },
  ctaText: {
    fontSize: 10,
    lineHeight: 14,
    fontFamily: fonts.semiBold,
    color: colors.white,
  },
});
