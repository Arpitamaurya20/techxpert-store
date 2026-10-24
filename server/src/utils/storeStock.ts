/** How many a store can sell. No store quantity means the company figure. A store quantity cannot exceed it. */
export function sellableAtStore(company: number, own: number | null): number {
  const companyQty = Math.max(0, Math.floor(Number(company) || 0));
  if (own == null) return companyQty;
  return Math.min(companyQty, Math.max(0, Math.floor(Number(own))));
}

/** The stores together cannot hold more than the company figure for that option. */
export function allocationOver(company: number, quantities: number[], label: string): string | null {
  const held = quantities.reduce((sum, quantity) => sum + Math.max(0, Math.floor(Number(quantity) || 0)), 0);
  const cap = Math.max(0, Math.floor(Number(company) || 0));
  if (held > cap) {
    return `The stores hold ${held} of ${label}, which is more than the ${cap} in stock.`;
  }
  return null;
}
