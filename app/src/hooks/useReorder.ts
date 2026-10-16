import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { useToast } from '@/components/ui/Toast';
import { getProductById } from '@/services/productApi';
import { addToCart } from '@/state/cartStore';
import type { Order } from '@/types/order';

/**
 * Adds an old order's items back to the cart using today's catalogue data,
 * so current price and stock rules apply. Items that are no longer sold or
 * cannot be added are reported, not silently skipped.
 */
export function useReorder() {
  const router = useRouter();
  const { showToast } = useToast();
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  const reorder = useCallback(
    async (order: Order) => {
      setReorderingId(order.id);
      let added = 0;
      let skipped = 0;

      for (const item of order.items) {
        try {
          const { data: product } = await getProductById(item.productId);
          if (!product) {
            skipped += 1;
            continue;
          }
          let result = addToCart(product, item.quantity);
          if (!result.ok && result.reason === 'invalid_quantity') result = addToCart(product);
          if (result.ok) added += 1;
          else skipped += 1;
        } catch {
          skipped += 1;
        }
      }

      setReorderingId(null);

      if (added === 0) {
        showToast({
          variant: 'error',
          message: 'None of these items can be added right now. They may be out of stock or no longer sold.',
        });
        return;
      }
      showToast({
        message:
          skipped > 0
            ? `Added ${added} of ${added + skipped} items. ${skipped} could not be added.`
            : `Added ${added} ${added === 1 ? 'item' : 'items'} to your cart`,
        action: { label: 'View Cart', onPress: () => router.navigate('/cart') },
      });
    },
    [router, showToast]
  );

  return { reorder, reorderingId };
}
