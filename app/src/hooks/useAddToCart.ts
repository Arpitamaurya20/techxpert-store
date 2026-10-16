import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { useToast } from '@/components/ui/Toast';
import { addToCart, type AddToCartFailure, type AddToCartResult } from '@/state/cartStore';
import type { Product } from '@/types/catalog';

type UseAddToCartOptions = {
  /** Raise the confirmation above screen-specific bottom bars. */
  toastBottomOffset?: number;
};

function failureMessage(reason: AddToCartFailure, maxQuantity: number): string {
  switch (reason) {
    case 'out_of_stock':
      return 'This item is out of stock.';
    case 'price_unavailable':
      return 'This item has no published price yet, so it cannot be added to the cart.';
    case 'limit_reached':
      return `You already have the maximum quantity (${maxQuantity}) in your cart.`;
    case 'invalid_quantity':
      return 'That quantity is not available for this item. Please adjust it and try again.';
  }
}

/** Adds a product to the shared cart and tells the user exactly what happened. */
export function useAddToCart({ toastBottomOffset }: UseAddToCartOptions = {}) {
  const router = useRouter();
  const { showToast } = useToast();

  return useCallback(
    (product: Product, quantity?: number): AddToCartResult => {
      const result = addToCart(product, quantity);

      if (result.ok) {
        showToast({
          message:
            result.added === result.quantity
              ? `Added to cart · ${result.quantity} in cart`
              : `Added ${result.added} · ${result.quantity} in cart`,
          action: { label: 'View Cart', onPress: () => router.navigate('/cart') },
          bottomOffset: toastBottomOffset,
        });
      } else {
        showToast({
          variant: 'error',
          bottomOffset: toastBottomOffset,
          message: failureMessage(result.reason, result.maxQuantity),
        });
      }
      return result;
    },
    [router, showToast, toastBottomOffset]
  );
}
