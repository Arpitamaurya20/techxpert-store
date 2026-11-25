import { useEffect, useRef } from 'react';

import { useToast } from '@/components/ui/Toast';
import { getAddresses } from '@/services/addressApi';
import { isApiConfigured } from '@/services/apiConfig';
import { mergeCartIntoAccount, refreshCart, resetCartAuth, retryAccountCartMerge, useCartNotice } from '@/state/cartStore';
import { replaceAddressesFromServer } from '@/state/locationStore';
import { getAuthToken, hydrateSession, useSession } from '@/state/sessionStore';

/**
 * Keeps the on-screen cart in step with the server: loads it at start, moves
 * the guest cart into the account on sign-in, reloads the guest cart on
 * sign-out, and shows why a cart change was refused.
 * Also pulls account addresses after sign-in so checkout can send `addressId`.
 */
export function CartSync() {
  const { showToast } = useToast();
  const token = useSession()?.token;
  const notice = useCartNotice();
  const shownNotice = useRef(0);

  useEffect(() => {
    if (!isApiConfigured) return;
    let cancelled = false;
    void (async () => {
      await hydrateSession();
      if (cancelled) return;
      if (getAuthToken()) {
        try {
          await mergeCartIntoAccount();
        } catch {
          // mergeCartIntoAccount already records a retryable error.
        }
      } else {
        resetCartAuth();
        await refreshCart();
      }
    })();
    if (token) {
      void getAddresses()
        .then(replaceAddressesFromServer)
        .catch(() => {
          // Keep device addresses if the profile list fails.
        });
    }
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!notice || notice.id === shownNotice.current) return;
    shownNotice.current = notice.id;
    showToast({
      variant: 'error',
      message: notice.message,
      ...(notice.retryMerge
        ? { action: { label: 'Retry', onPress: () => void retryAccountCartMerge().catch(() => undefined) } }
        : {}),
    });
  }, [notice, showToast]);

  return null;
}
