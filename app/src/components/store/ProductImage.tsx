import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { MaterialIconName } from '@/utils/categoryIcon';

type ProductImageProps = {
  uri?: string;
  fallbackIcon: MaterialIconName;
  accessibilityLabel: string;
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
};

/** Shows the product photo, or a neutral category icon when there is no image or it fails to load. */
export function ProductImage({
  uri,
  fallbackIcon,
  accessibilityLabel,
  iconSize = 44,
  style,
}: ProductImageProps) {
  const [failedUri, setFailedUri] = useState<string | undefined>();
  const showImage = !!uri && failedUri !== uri;

  return (
    <View style={[styles.frame, style]}>
      {showImage ? (
        <Image
          source={{ uri }}
          style={styles.image}
          resizeMode="contain"
          accessibilityLabel={accessibilityLabel}
          onError={() => setFailedUri(uri)}
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
  image: {
    width: '100%',
    height: '100%',
  },
});
