import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import type { MaterialIconName } from '@/utils/categoryIcon';

import { ProductImage } from './ProductImage';

type ProductImageGalleryProps = {
  images: string[];
  productName: string;
  /** Bundled photo shown when the product has no images. */
  localSource?: ImageSourcePropType;
  fallbackIcon: MaterialIconName;
  /** Borderless look; several photos get a thumbnail column beside the main photo and dots below. */
  bare?: boolean;
};

const ASPECT_RATIO = 4 / 3;
const MAX_HEIGHT = 420;
const THUMB_SIZE = 56;

/** One photo shows on its own; carousel controls appear only when the product has several. */
export function ProductImageGallery({
  images,
  productName,
  localSource,
  fallbackIcon,
  bare = false,
}: ProductImageGalleryProps) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<string>>(null);
  const height = Math.min(width / ASPECT_RATIO, MAX_HEIGHT);
  const hasMany = images.length > 1;

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(Math.round(event.nativeEvent.layout.width));
  }, []);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (width === 0) return;
      const next = Math.round(event.nativeEvent.contentOffset.x / width);
      setIndex(Math.max(0, Math.min(next, images.length - 1)));
    },
    [width, images.length]
  );

  const goTo = (target: number) => {
    const next = Math.max(0, Math.min(target, images.length - 1));
    listRef.current?.scrollToOffset({ offset: next * width, animated: true });
    setIndex(next);
  };

  if (!hasMany) {
    return (
      <ProductImage
        uri={images[0]}
        localSource={localSource}
        localFit="contain"
        fallbackIcon={fallbackIcon}
        accessibilityLabel={productName}
        iconSize={88}
        style={[styles.single, bare && styles.bare]}
      />
    );
  }

  if (bare) {
    return (
      <View style={styles.bareWrap}>
        <View style={styles.bareRow}>
          <View style={styles.bareMain} onLayout={onLayout}>
            {width > 0 ? (
              <FlatList
                ref={listRef}
                data={images}
                keyExtractor={(uri, itemIndex) => `${itemIndex}-${uri}`}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={32}
                getItemLayout={(_, itemIndex) => ({
                  length: width,
                  offset: width * itemIndex,
                  index: itemIndex,
                })}
                renderItem={({ item, index: itemIndex }) => (
                  <ProductImage
                    uri={item}
                    fallbackIcon={fallbackIcon}
                    accessibilityLabel={`${productName}, image ${itemIndex + 1} of ${images.length}`}
                    iconSize={88}
                    style={{ width, height: width }}
                  />
                )}
              />
            ) : (
              <View style={{ aspectRatio: 1 }} />
            )}
          </View>

          <ScrollView
            style={[styles.thumbs, width > 0 && { maxHeight: width }]}
            contentContainerStyle={styles.thumbsContent}
            showsVerticalScrollIndicator={false}
          >
            {images.map((uri, thumbIndex) => (
              <Pressable
                key={`${thumbIndex}-${uri}`}
                onPress={() => goTo(thumbIndex)}
                accessibilityRole="button"
                accessibilityLabel={`Show image ${thumbIndex + 1} of ${images.length}`}
                accessibilityState={{ selected: thumbIndex === index }}
                style={[styles.thumb, thumbIndex === index && styles.thumbActive]}
              >
                <ProductImage
                  uri={uri}
                  fallbackIcon={fallbackIcon}
                  accessibilityLabel=""
                  iconSize={20}
                  style={styles.thumbImage}
                />
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={[styles.dots, styles.dotsBelow]} accessible accessibilityLabel={`Image ${index + 1} of ${images.length}`}>
          {images.map((uri, dotIndex) => (
            <View key={`${dotIndex}-${uri}`} style={[styles.dot, dotIndex === index && styles.dotActive]} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.frame}>
      {/* Measured inside the frame's border so each page is exactly one viewport wide. */}
      <View onLayout={onLayout}>
        {width > 0 ? (
          <FlatList
            ref={listRef}
            data={images}
            keyExtractor={(uri, itemIndex) => `${itemIndex}-${uri}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={32}
            getItemLayout={(_, itemIndex) => ({
              length: width,
              offset: width * itemIndex,
              index: itemIndex,
            })}
            renderItem={({ item, index: itemIndex }) => (
              <ProductImage
                uri={item}
                fallbackIcon={fallbackIcon}
                accessibilityLabel={`${productName}, image ${itemIndex + 1} of ${images.length}`}
                iconSize={88}
                style={{ width, height }}
              />
            )}
          />
        ) : (
          <View style={{ aspectRatio: ASPECT_RATIO, maxHeight: MAX_HEIGHT }} />
        )}
      </View>

      {index > 0 ? (
        <ArrowButton direction="back" label="Previous image" onPress={() => goTo(index - 1)} />
      ) : null}
      {index < images.length - 1 ? (
        <ArrowButton direction="forward" label="Next image" onPress={() => goTo(index + 1)} />
      ) : null}

      <View
        style={styles.dots}
        accessible
        accessibilityLabel={`Image ${index + 1} of ${images.length}`}
      >
        {images.map((uri, dotIndex) => (
          <View key={`${dotIndex}-${uri}`} style={[styles.dot, dotIndex === index && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

type ArrowButtonProps = {
  direction: 'back' | 'forward';
  label: string;
  onPress: () => void;
};

function ArrowButton({ direction, label, onPress }: ArrowButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [
        styles.arrow,
        direction === 'back' ? styles.arrowBack : styles.arrowForward,
        pressed && styles.arrowPressed,
      ]}
    >
      <Ionicons name={direction === 'back' ? 'chevron-back' : 'chevron-forward'} size={22} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  single: {
    width: '100%',
    aspectRatio: ASPECT_RATIO,
    maxHeight: MAX_HEIGHT,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  frame: {
    width: '100%',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    backgroundColor: '#EEF2F6',
  },
  bare: {
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: colors.card,
  },
  bareWrap: {
    paddingHorizontal: spacing.lg,
  },
  bareRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  bareMain: {
    flex: 1,
    minWidth: 0,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  thumbs: {
    width: THUMB_SIZE,
    flexGrow: 0,
  },
  thumbsContent: {
    gap: spacing.sm,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  thumbActive: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  dotsBelow: {
    position: 'relative',
    bottom: 0,
    marginVertical: spacing.sm,
    backgroundColor: 'transparent',
  },
  arrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  arrowBack: {
    left: spacing.sm,
  },
  arrowForward: {
    right: spacing.sm,
  },
  arrowPressed: {
    backgroundColor: colors.surface,
  },
  dots: {
    position: 'absolute',
    bottom: spacing.sm,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.disabled,
  },
  dotActive: {
    width: 18,
    backgroundColor: colors.accent,
  },
});
