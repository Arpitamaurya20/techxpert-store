import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SCREEN_PADDING, cardShadow, colors, fonts, radius, spacing } from '@/constants/theme';
import { SHOP_PROJECTS } from '@/data/homeContent';
import type { HomeProject } from '@/services/cmsApi';

import { SectionHeader } from './SectionHeader';

const CARD_WIDTH = 140;

type ShopByProjectProps = {
  /** Published projects. Leave this out to use the app's own list. An empty list draws nothing. */
  published?: HomeProject[];
};

/** Swipeable project cards; each opens the list of categories needed for that job. */
export function ShopByProject({ published }: ShopByProjectProps) {
  const router = useRouter();
  if (published && published.length === 0) return null;
  const projects = published ?? SHOP_PROJECTS;

  return (
    <View style={styles.section}>
      <SectionHeader title="Shop by Project" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroller}
        contentContainerStyle={styles.row}
      >
        {projects.map((project) => (
          <Pressable
            key={project.id}
            onPress={() => router.push({ pathname: '/project/[id]', params: { id: project.id } })}
            accessibilityRole="button"
            accessibilityLabel={`${project.title} project. ${project.subtitle}`}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <Image
              source={'imageUrl' in project && project.imageUrl ? { uri: project.imageUrl } : 'image' in project ? project.image : undefined}
              style={styles.image}
              contentFit="cover"
              accessible={false}
            />
            <View style={styles.text}>
              <Text style={styles.title} numberOfLines={1}>
                {project.title}
              </Text>
              <Text style={styles.subtitle} numberOfLines={2}>
                {project.subtitle}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  scroller: {
    flexGrow: 0,
    marginHorizontal: -SCREEN_PADDING,
  },
  row: {
    gap: spacing.md,
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 4,
  },
  card: {
    width: CARD_WIDTH,
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    ...cardShadow,
  },
  pressed: {
    opacity: 0.88,
  },
  image: {
    width: '100%',
    height: 96,
    backgroundColor: colors.surface,
  },
  text: {
    gap: 2,
    padding: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.bold,
    color: colors.navy,
  },
  subtitle: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
});
