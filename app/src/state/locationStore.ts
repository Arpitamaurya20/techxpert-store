import { createStore } from './createStore';

export type DeliveryLocation = {
  pincode: string;
  city: string;
};

/** Starts empty: the app never guesses an address. Kept in memory for this session. */
export const locationStore = createStore<DeliveryLocation | null>(null);

export function setDeliveryLocation(location: DeliveryLocation) {
  locationStore.setState(location);
}

export function useDeliveryLocation() {
  return locationStore.useStore((location) => location);
}
