import { useRouter } from 'expo-router';

import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/**
 * Development placeholder so Cart → Checkout navigation can be tested.
 * Does not collect an address, take payment, or place an order.
 */
export default function CheckoutPlaceholderScreen() {
  const router = useRouter();

  return (
    <PlaceholderScreen
      icon="card-outline"
      title="Checkout is not available yet"
      message="Delivery address, payment and order placement will be added in a later step. Nothing has been charged, and the items in your cart are unchanged."
      action={{
        label: 'Back to Cart',
        icon: 'arrow-back',
        onPress: () => (router.canGoBack() ? router.back() : router.replace('/cart')),
      }}
    />
  );
}
