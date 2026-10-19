import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { colors, fonts, radius, spacing } from '@/constants/theme';
import { HERO_SLIDES, type HeroSlide } from '@/data/homeContent';

const AUTO_ADVANCE_MS = 5000;

type HeroCarouselProps = {
  width: number;
};

function Slide({ slide, width, height }: { slide: HeroSlide; width: number; height: number }) {
  const router = useRouter();
  const dark = slide.tone === 'dark';

  return (
    <Pressable
      onPress={() => router.push(slide.href)}
      accessibilityRole="button"
      accessibilityLabel={`${slide.title.replace(/\n/g, ' ')}. ${slide.subtitle.replace(/\n/g, ' ')}. ${slide.cta}`}
      style={[styles.slide, { width, height }]}
    >
      <Image source={slide.image} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
      <View style={[styles.scrim, dark ? styles.scrimDark : styles.scrimLight]} />
      <View style={styles.copy}>
        <Text style={[styles.eyebrow, !dark && styles.eyebrowLight]}>{slide.eyebrow.toUpperCase()}</Text>
        <Text style={[styles.title, !dark && styles.titleLight]}>{slide.title}</Text>
        <Text style={[styles.subtitle, !dark && styles.subtitleLight]} numberOfLines={2}>
          {slide.subtitle}
        </Text>
        <View style={styles.cta}>
          <Text style={styles.ctaText}>{slide.cta}</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.white} />
        </View>
      </View>
    </Pressable>
  );
}

/** Swipeable promo banners; auto-advance stops once the shopper swipes or uses a screen reader. */
export function HeroCarousel({ width }: HeroCarouselProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const height = Math.round(Math.min(Math.max(width * 0.58, 200), 320));

  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
      if (enabled) setAutoPlay(false);
    });
  }, []);

  useEffect(() => {
    if (!autoPlay || width === 0) return;
    const timer = setTimeout(() => {
      const next = (index + 1) % HERO_SLIDES.length;
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
      setIndex(next);
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [autoPlay, index, width]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== index && next >= 0 && next < HERO_SLIDES.length) setIndex(next);
  };

  const goTo = (next: number) => {
    setAutoPlay(false);
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
    setIndex(next);
  };

  return (
    <View style={styles.wrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        onScrollBeginDrag={() => setAutoPlay(false)}
        scrollEventThrottle={16}
        style={[styles.scroller, { width, height }]}
      >
        {HERO_SLIDES.map((slide) => (
          <Slide key={slide.id} slide={slide} width={width} height={height} />
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {HERO_SLIDES.map((slide, dotIndex) => (
          <Pressable
            key={slide.id}
            onPress={() => goTo(dotIndex)}
            accessibilityRole="button"
            accessibilityLabel={`Show banner ${dotIndex + 1} of ${HERO_SLIDES.length}`}
            accessibilityState={{ selected: dotIndex === index }}
            hitSlop={10}
            style={styles.dotHit}
          >
            <View style={[styles.dot, dotIndex === index && styles.dotActive]} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  scroller: {
    flexGrow: 0,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  slide: {
    overflow: 'hidden',
    justifyContent: 'center',
    backgroundColor: colors.navyDeep,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
  },
  scrimDark: {
    backgroundColor: 'rgba(7, 28, 61, 0.28)',
  },
  scrimLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  copy: {
    maxWidth: '68%',
    paddingHorizontal: spacing.lg,
    alignItems: 'flex-start',
  },
  eyebrow: {
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 0.8,
    fontFamily: fonts.medium,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  eyebrowLight: {
    color: colors.orange,
  },
  title: {
    marginTop: 4,
    fontSize: 21,
    lineHeight: 25,
    fontFamily: fonts.bold,
    color: colors.white,
  },
  titleLight: {
    color: colors.navy,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 15,
    fontFamily: fonts.regular,
    color: 'rgba(255, 255, 255, 0.92)',
  },
  subtitleLight: {
    color: colors.navy,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.orange,
  },
  ctaText: {
    fontSize: 14,
    lineHeight: 19,
    fontFamily: fonts.semiBold,
    color: colors.white,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  dotHit: {
    padding: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 18,
    backgroundColor: colors.orange,
  },
});
