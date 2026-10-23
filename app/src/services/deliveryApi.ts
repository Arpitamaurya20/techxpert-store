import { ApiError, apiGet } from './apiClient';
import { asRecord, asText } from './normalize';

/**
 * Delivery check (GET /delivery/pincodes/:pincode, public):
 *   → { data: { pincode, serviceable, areaName?, message } }
 * The server decides again when the order is placed.
 */
export type PincodeCheck = {
  pincode: string;
  serviceable: boolean;
  areaName?: string;
  message: string;
};

export async function checkPincode(pincode: string): Promise<PincodeCheck> {
  const raw = await apiGet(`/delivery/pincodes/${encodeURIComponent(pincode)}`);
  const record = asRecord(asRecord(raw)?.data) ?? asRecord(raw);
  const message = asText(record?.message);
  if (!record || typeof record.serviceable !== 'boolean' || !message) {
    throw new ApiError('INVALID_RESPONSE', 'We could not check this pincode. Please try again.');
  }
  return {
    pincode: asText(record.pincode) ?? pincode,
    serviceable: record.serviceable,
    areaName: asText(record.areaName),
    message,
  };
}
