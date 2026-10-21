import { createPersistentStore } from './createPersistentStore';

export type DeliveryLocation = {
  pincode: string;
  city: string;
};

export const ADDRESS_LABELS = ['Home', 'Office', 'Other'] as const;
export type AddressLabel = (typeof ADDRESS_LABELS)[number];

export type SavedAddress = DeliveryLocation & {
  id: string;
  label: AddressLabel;
  /** House, building, street and area. */
  line: string;
};

type LocationState = {
  /** Where orders are delivered; the app never guesses it. */
  current: DeliveryLocation | null;
  addresses: SavedAddress[];
  /** The saved address that `current` came from, shown as the default. */
  defaultId: string | null;
};

const INITIAL_STATE: LocationState = { current: null, addresses: [], defaultId: null };

function isLocation(value: unknown): value is DeliveryLocation {
  if (typeof value !== 'object' || value === null) return false;
  const { pincode, city } = value as Record<string, unknown>;
  return typeof pincode === 'string' && typeof city === 'string';
}

function isAddress(value: unknown): value is SavedAddress {
  if (!isLocation(value)) return false;
  const { id, label, line } = value as unknown as Record<string, unknown>;
  return (
    typeof id === 'string' &&
    typeof line === 'string' &&
    ADDRESS_LABELS.includes(label as AddressLabel)
  );
}

function parseLocationState(saved: unknown): LocationState | undefined {
  if (typeof saved !== 'object' || saved === null) return undefined;
  const { current, addresses, defaultId } = saved as Record<string, unknown>;
  if (current !== null && !isLocation(current)) return undefined;
  if (!Array.isArray(addresses) || !addresses.every(isAddress)) return undefined;
  if (defaultId !== null && typeof defaultId !== 'string') return undefined;
  return { current, addresses, defaultId };
}

/** Saved on this device only. */
export const locationStore = createPersistentStore<LocationState>(
  'techxpert.addresses',
  INITIAL_STATE,
  parseLocationState
);

function newId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Sets the delivery location without saving it as an address, e.g. the one stored on the account. */
export function setDeliveryLocation(location: DeliveryLocation) {
  locationStore.setState({ ...locationStore.getState(), current: location, defaultId: null });
}

export function useDeliveryLocation() {
  return locationStore.useStore((state) => state.current);
}

export function useSavedAddresses() {
  return locationStore.useStore((state) => state.addresses);
}

export function useDefaultAddressId() {
  return locationStore.useStore((state) => state.defaultId);
}

export function getSavedAddress(id: string) {
  return locationStore.getState().addresses.find((address) => address.id === id);
}

/** Adds a new address, or updates the one with the same id. Returns the saved address. */
export function saveAddress(input: Omit<SavedAddress, 'id'> & { id?: string }): SavedAddress {
  const state = locationStore.getState();
  const address: SavedAddress = { ...input, id: input.id ?? newId() };
  const exists = state.addresses.some((item) => item.id === address.id);
  const addresses = exists
    ? state.addresses.map((item) => (item.id === address.id ? address : item))
    : [...state.addresses, address];
  const isDefault = state.defaultId === address.id;
  locationStore.setState({
    ...state,
    addresses,
    current: isDefault ? { city: address.city, pincode: address.pincode } : state.current,
  });
  return address;
}

/** Delivers to this saved address and marks it as the default. */
export function deliverToAddress(id: string) {
  const state = locationStore.getState();
  const address = state.addresses.find((item) => item.id === id);
  if (!address) return;
  locationStore.setState({
    ...state,
    current: { city: address.city, pincode: address.pincode },
    defaultId: address.id,
  });
}

/** Removes an address; returns a function that puts it back exactly as it was. */
export function deleteAddress(id: string): () => void {
  const before = locationStore.getState();
  const isDefault = before.defaultId === id;
  locationStore.setState({
    addresses: before.addresses.filter((item) => item.id !== id),
    current: isDefault ? null : before.current,
    defaultId: isDefault ? null : before.defaultId,
  });
  return () => locationStore.setState(before);
}
