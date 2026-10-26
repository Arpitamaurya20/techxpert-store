export type PlacedOrder = { id: string | number; orderNumber: string; source?: string | null };

export type PlaceOrderSeed = {
  name: string;
  phone: string;
  pincode: string;
  address: string;
  note: string;
  requestId: string | null;
  lines: { productId: string; variantId: string; quantity: string }[];
};

const emptyLine = () => ({ productId: '', variantId: '', quantity: '1' });

export const emptyPlaceOrder = (): PlaceOrderSeed => ({
  name: '',
  phone: '',
  pincode: '',
  address: '',
  note: '',
  requestId: null,
  lines: [emptyLine()],
});
