/** Why staff can't move an order from `current` to `next`, or null when they can. */
export function statusChangeRefusal(current: string, next: string): string | null {
  if (current === 'cancelled') return 'This order is already cancelled, and a cancelled order stays cancelled.';
  if (current === 'delivered' && next === 'cancelled') {
    return "A delivered order can't be cancelled. Taking goods back is a return, which the portal doesn't handle.";
  }
  return null;
}

/**
 * Only orders placed through this shop took stock at checkout (`OrderService.writeOrder` numbers them `TX-ORD-`).
 * Imported orders may never have, so cancelling them puts nothing back.
 */
export function restocksOnCancel(orderNumber: unknown): boolean {
  return typeof orderNumber === 'string' && orderNumber.startsWith('TX-ORD-');
}
