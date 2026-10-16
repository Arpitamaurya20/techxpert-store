import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
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
  fallbackIcon: MaterialIconName;
};

const ASPECT_RATIO = 4 / 3;
const MAX_HEIGHT = 420;

/** One photo shows on its own; carousel controls appear only when the product has several. */
export function ProductImageGallery({ images, productName, fallbackIcon }: ProductImageGalleryProps) {
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
        fallbackIcon={fallbackIcon}
        accessibilityLabel={productName}
        iconSize={88}
        style={styles.single}
      />
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
