import { useEffect, useRef } from 'react';

import { useToast } from '@/components/ui/Toast';
import { getAddresses } from '@/services/addressApi';
import { isApiConfigured } from '@/services/apiConfig';
import { mergeCartIntoAccount, refreshCart, useCartNotice } from '@/state/cartStore';
import { replaceAddressesFromServer } from '@/state/locationStore';
import { useSession } from '@/state/sessionStore';

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
  const previousToken = useRef<string | undefined>(undefined);
  const started = useRef(false);
  const shownNotice = useRef(0);

  useEffect(() => {
    if (!isApiConfigured) return;
    const signedIn = Boolean(token) && !previousToken.current;
    previousToken.current = token;
    if (signedIn && started.current) void mergeCartIntoAccount();
    else void refreshCart();
    if (token) {
      void getAddresses()
        .then(replaceAddressesFromServer)
        .catch(() => {
          // Keep device addresses if the profile list fails.
        });
    }
    started.current = true;
  }, [token]);

  useEffect(() => {
    if (!notice || notice.id === shownNotice.current) return;
    shownNotice.current = notice.id;
    showToast({ variant: 'error', message: notice.message });
  }, [notice, showToast]);

  return null;
}
