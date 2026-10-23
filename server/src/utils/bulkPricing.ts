export type Tier = {
  id: number | string;
  minQty: number;
  maxQty: number | null;
  /** `percentage`: percent off the base price. `fixed_price`: `discountValue` is the unit price. */
  discountType: string;
  discountValue: number;
  terms: string;
};

export type BulkPriceResult = {
  basePrice: number;
  unitPrice: number;
  discountPercent: number;
  discountPerUnit: number;
  subtotal: number;
  totalSavings: number;
  appliedTier: Pick<Tier, 'id' | 'minQty' | 'maxQty' | 'discountValue' | 'discountType' | 'terms'> | null;
};

const money = (value: number) => Math.round(value * 100) / 100;

function unitPriceUnder(tier: Tier, basePrice: number): number {
  const value = Number(tier.discountValue);
  const price = tier.discountType === 'percentage' ? basePrice - (basePrice * value) / 100 : value;
  return Math.min(Math.max(price, 0), basePrice);
}

/**
 * The price for this quantity: of the tiers that cover it, the one giving the lowest unit price.
 * Percent and fixed-price tiers are compared by the price they give, not by their raw values.
 */
export function bulkPrice(tiers: Tier[], quantity: number, basePrice: number): BulkPriceResult {
  const qty = Math.max(Math.floor(Number(quantity)) || 1, 1);
  let best: Tier | null = null;
  let bestPrice = basePrice;
  for (const tier of tiers) {
    const min = Number(tier.minQty);
    const max = tier.maxQty == null ? null : Number(tier.maxQty);
    if (qty < min || (max && qty > max)) continue;
    const price = unitPriceUnder(tier, basePrice);
    if (price < bestPrice) {
      best = tier;
      bestPrice = price;
    }
  }

  const unitPrice = money(bestPrice);
  const discountPerUnit = money(basePrice - unitPrice);
  return {
    basePrice,
    unitPrice,
    discountPercent:
      best?.discountType === 'percentage'
        ? Number(best.discountValue)
        : basePrice > 0
          ? money((discountPerUnit / basePrice) * 100)
          : 0,
    discountPerUnit,
    subtotal: money(unitPrice * qty),
    totalSavings: money(discountPerUnit * qty),
    appliedTier: best
      ? {
          id: best.id,
          minQty: best.minQty,
          maxQty: best.maxQty,
          discountValue: best.discountValue,
          discountType: best.discountType,
          terms: best.terms,
        }
      : null,
  };
}
