const wholeRupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const rupeesWithPaise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats rupees in Indian style, e.g. 125000 → "₹1,25,000". */
export function formatPrice(amount: number): string {
  return Number.isInteger(amount) ? wholeRupees.format(amount) : rupeesWithPaise.format(amount);
}

/** Whole paise, so line totals do not drift from floating-point multiplication. */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function fromPaise(paise: number): number {
  return paise / 100;
}

export function lineSubtotal(unitPrice: number, quantity: number): number {
  return fromPaise(toPaise(unitPrice) * quantity);
}

export function discountPercent(price: number, originalPrice?: number): number | undefined {
  if (!originalPrice || originalPrice <= price) return undefined;
  return Math.round(((originalPrice - price) / originalPrice) * 100);
}
