import { useEffect, useState } from 'react';

import { getErrorMessage } from '@/services/apiClient';
import { isApiConfigured } from '@/services/apiConfig';
import { checkPincode } from '@/services/deliveryApi';

export type PincodeStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'serviceable'; message: string }
  | { state: 'unserviceable'; message: string }
  | { state: 'error'; message: string };

type Answer = { pincode: string; status: PincodeStatus };

const CHECK_DELAY_MS = 300;

/** Asks the server whether it delivers to a full 6-digit pincode, shortly after typing stops. */
export function usePincodeCheck(pincode: string): PincodeStatus {
  const complete = /^[1-9]\d{5}$/.test(pincode);
  const [answer, setAnswer] = useState<Answer | null>(null);

  useEffect(() => {
    if (!isApiConfigured || !complete) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      checkPincode(pincode)
        .then((result) => {
          if (cancelled) return;
          setAnswer({
            pincode,
            status: { state: result.serviceable ? 'serviceable' : 'unserviceable', message: result.message },
          });
        })
        .catch((error) => {
          if (!cancelled) setAnswer({ pincode, status: { state: 'error', message: getErrorMessage(error) } });
        });
    }, CHECK_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pincode, complete]);

  if (!isApiConfigured || !complete) return { state: 'idle' };
  return answer?.pincode === pincode ? answer.status : { state: 'checking' };
}
