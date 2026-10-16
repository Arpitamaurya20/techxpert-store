import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';

import type { MaterialIconName } from '@/utils/categoryIcon';

type ProductImageProps = {
  uri?: string;
  /** Bundled photo used when there is no `uri` or it fails, before falling back to the icon. */
  localSource?: ImageSourcePropType;
  /** How `localSource` fills the frame; large galleries use "contain" so nothing is cropped. */
  localFit?: 'cover' | 'contain';
  fallbackIcon: MaterialIconName;
  accessibilityLabel: string;
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
};

/** Shows the product photo, or a neutral category icon when there is no image or it fails to load. */
export function ProductImage({
  uri,
  localSource,
  localFit = 'cover',
  fallbackIcon,
  accessibilityLabel,
  iconSize = 44,
  style,
}: ProductImageProps) {
  const [failedUri, setFailedUri] = useState<string | undefined>();
  const showImage = !!uri && failedUri !== uri;
  const letterboxed = !showImage && !!localSource && localFit === 'contain';

  return (
    <View style={[styles.frame, style, letterboxed && styles.whiteFrame]}>
      {showImage ? (
        <Image
          source={{ uri }}
          style={styles.image}
          resizeMode="contain"
          accessibilityLabel={accessibilityLabel}
          onError={() => setFailedUri(uri)}
        />
      ) : localSource ? (
        <Image
          source={localSource}
          style={styles.image}
          resizeMode={localFit}
          accessibilityLabel={accessibilityLabel}
        />
      ) : (
        <MaterialCommunityIcons
          name={fallbackIcon}
          size={iconSize}
          color="#8CA0B3"
          accessibilityLabel={`${accessibilityLabel} (image not available)`}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2F6',
    overflow: 'hidden',
  },
  whiteFrame: {
    backgroundColor: '#FFFFFF',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
