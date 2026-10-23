import type { BulkPriceTier } from '../types';
import { inr } from './format';

/** "10–49" or "50 and more". */
export const tierQuantity = (tier: Pick<BulkPriceTier, 'minQty' | 'maxQty'>): string =>
  tier.maxQty ? `${tier.minQty}–${tier.maxQty}` : `${tier.minQty} and more`;

/** "10% off" or "₹350.00 each". */
export const tierPrice = (tier: Pick<BulkPriceTier, 'discountType' | 'discountValue'>): string =>
  tier.discountType === 'fixed_price' ? `${inr(Number(tier.discountValue))} each` : `${Number(tier.discountValue)}% off`;

/** "10% off for 10–49 of UltraTech Cement", for audit entries and confirms. */
export const tierSummary = (tier: BulkPriceTier): string =>
  `${tierPrice(tier)} for ${tierQuantity(tier)}${tier.productName ? ` of ${tier.productName}` : ''}`;
