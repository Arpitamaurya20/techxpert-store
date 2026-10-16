import { useRouter } from 'expo-router';

import { IconButton } from '@/components/ui/IconButton';
import { useCartCount } from '@/state/cartStore';

/** Cart icon for light stack headers; the badge reads the shared cart. */
export function HeaderCartButton() {
  const router = useRouter();
  const cartCount = useCartCount();

  return (
    <IconButton
      icon="cart-outline"
      accessibilityLabel="Cart"
      badgeCount={cartCount}
      surface="light"
      onPress={() => router.navigate('/cart')}
    />
  );
}
