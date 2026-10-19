import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';

import { cardShadow, colors } from '@/constants/theme';
import { toggleWishlist, useIsWishlisted } from '@/state/wishlistStore';

const SAVED_COLOR = '#E5484D';

type WishlistButtonProps = {
  productId: string;
  productName: string;
  /** "small" sits on product card photos; "large" is the round button on the product page. */
  size?: 'small' | 'large';
};

export function WishlistButton({ productId, productName, size = 'small' }: WishlistButtonProps) {
  const saved = useIsWishlisted(productId);
  const large = size === 'large';

  return (
    <Pressable
      onPress={() => toggleWishlist(productId)}
      accessibilityRole="button"
      accessibilityLabel={saved ? `Remove ${productName} from saved items` : `Save ${productName}`}
      accessibilityState={{ selected: saved }}
      hitSlop={large ? 4 : 8}
      style={({ pressed }) => [styles.button, large ? styles.large : styles.small, pressed && styles.pressed]}
    >
      <Ionicons
        name={saved ? 'heart' : 'heart-outline'}
        size={large ? 20 : 15}
        color={saved ? SAVED_COLOR : colors.navy}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    ...cardShadow,
  },
  small: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  large: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  pressed: {
    backgroundColor: colors.navySoft,
  },
});
