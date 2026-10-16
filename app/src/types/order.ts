export type OrderStatus =
  | 'placed'
  | 'confirmed'
  | 'packed'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'returned';

export type OrderItem = {
  productId: string;
  name: string;
  quantity: number;
  /** Price paid per unit on this order; reordering always uses today's catalogue price. */
  unitPrice?: number;
  unit?: string;
  imageUrl?: string;
  categoryId?: string;
};

export type Order = {
  id: string;
  /** Customer-facing number, e.g. "TX-10234"; falls back to `id`. */
  orderNumber: string;
  /** ISO date the order was placed. */
  placedAt?: string;
  /** Unknown statuses from the server are shown as sent, never guessed. */
  status?: OrderStatus;
  statusLabel?: string;
  items: OrderItem[];
  /** Amount charged in rupees, as reported by the server. */
  total?: number;
};
