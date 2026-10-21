import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { GLASS_HEADER_HEIGHT_ESTIMATE, GlassScreenHeader } from '@/components/ui/GlassScreenHeader';
import { StateView } from '@/components/ui/StateView';
import { useToast } from '@/components/ui/Toast';
import { MAX_CONTENT_WIDTH, SCREEN_PADDING, cardShadow, colors, fonts, radius, spacing } from '@/constants/theme';
import { useStatusBarStyle } from '@/hooks/useStatusBarStyle';
import {
  deleteAddress,
  deliverToAddress,
  useDefaultAddressId,
  useSavedAddresses,
  type AddressLabel,
  type SavedAddress,
} from '@/state/locationStore';

/** Used until the bottom bar reports its real height. */
const BAR_HEIGHT_ESTIMATE = 88;

const LABEL_ICONS: Record<AddressLabel, ComponentProps<typeof Ionicons>['name']> = {
  Home: 'home-outline',
  Office: 'business-outline',
  Other: 'location-outline',
};

export default function DeliveryLocationScreen() {
  useStatusBarStyle('dark');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const addresses = useSavedAddresses();
  const defaultId = useDefaultAddressId();
  const [headerHeight, setHeaderHeight] = useState(insets.top + GLASS_HEADER_HEIGHT_ESTIMATE);
  const [barHeight, setBarHeight] = useState(BAR_HEIGHT_ESTIMATE);
  const [picked, setPicked] = useState<string | null>(null);

  const selectedId =
    picked && addresses.some((address) => address.id === picked)
      ? picked
      : (defaultId ?? addresses[0]?.id ?? null);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate('/home');
    }
  };

  const save = () => {
    if (!selectedId) return;
    deliverToAddress(selectedId);
    goBack();
  };

  const remove = (address: SavedAddress) => {
    const undo = deleteAddress(address.id);
    showToast({
      message: `${address.label} address removed.`,
      action: { label: 'Undo', onPress: undo },
      bottomOffset: addresses.length > 1 ? barHeight : spacing.lg,
    });
  };

  const addNew = () => router.push('/address-form');

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + spacing.md,
            paddingBottom: (addresses.length > 0 ? barHeight : insets.bottom) + spacing.lg,
          },
        ]}
        scrollIndicatorInsets={{ top: headerHeight }}
      >
        <View style={styles.inner}>
          {addresses.length === 0 ? (
            <StateView
              variant="empty"
              icon="location-outline"
              title="No saved addresses"
              message="Add the address where you want your orders delivered. It is saved on this device."
              actionLabel="Add Address"
              onAction={addNew}
            />
          ) : (
            <View accessibilityRole="radiogroup" style={styles.list}>
              {addresses.map((address) => (
                <AddressCard
                  key={address.id}
                  address={address}
                  selected={address.id === selectedId}
                  isDefault={address.id === defaultId}
                  onSelect={() => setPicked(address.id)}
                  onEdit={() => router.push({ pathname: '/address-form', params: { id: address.id } })}
                  onDelete={() => remove(address)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <GlassScreenHeader
        title="Delivery Address"
        fallback="/home"
        onHeightChange={setHeaderHeight}
        right={
          <Pressable
            onPress={addNew}
            accessibilityRole="button"
            accessibilityLabel="Add new address"
            hitSlop={8}
            style={({ pressed }) => [styles.addNew, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={18} color={colors.navy} />
            <Text style={styles.addNewText}>Add New</Text>
          </Pressable>
        }
      />

      {addresses.length > 0 ? (
        <View
          style={[styles.bar, { paddingBottom: insets.bottom + spacing.md }]}
          onLayout={(event) => setBarHeight(Math.round(event.nativeEvent.layout.height))}
        >
          <View style={styles.barInner}>
            <Button title="Save Address" onPress={save} disabled={!selectedId} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

type AddressCardProps = {
  address: SavedAddress;
  selected: boolean;
  isDefault: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

function AddressCard({ address, selected, isDefault, onSelect, onEdit, onDelete }: AddressCardProps) {
  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${address.label}${isDefault ? ', default' : ''}. ${address.line}, ${address.city} ${address.pincode}`}
      style={({ pressed }) => [styles.card, selected && styles.cardSelected, pressed && styles.pressed]}
    >
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Ionicons name={LABEL_ICONS[address.label]} size={16} color={colors.navy} />
          <Text style={styles.cardTitle}>{address.label}</Text>
          {isDefault ? (
            <View style={styles.defaultPill}>
              <Text style={styles.defaultText}>Default</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.addressText}>{address.line}</Text>
        <Text style={styles.addressText}>
          {address.city} - {address.pincode}
        </Text>
      </View>

      <View style={styles.cardActions}>
        <Pressable
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${address.label} address`}
          hitSlop={4}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed]}
        >
          <Ionicons name="create-outline" size={19} color={colors.navy} />
        </Pressable>
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${address.label} address`}
          hitSlop={4}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed]}
        >
          <Ionicons name="trash-outline" size={19} color={colors.navy} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screen,
  },
  content: {
    paddingHorizontal: SCREEN_PADDING,
  },
  inner: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  list: {
    gap: spacing.md,
  },
  addNew: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  addNewText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.semiBold,
    color: colors.navy,
  },
  pressed: {
    opacity: 0.75,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    ...cardShadow,
  },
  cardSelected: {
    borderColor: colors.navy,
    borderWidth: 1.5,
  },
  radio: {
    width: 22,
    height: 22,
    marginTop: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
  },
  radioOn: {
    borderColor: colors.navy,
  },
  radioDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.navy,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: fonts.bold,
    color: colors.navy,
  },
  defaultPill: {
    marginLeft: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.successSoft,
  },
  defaultText: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: fonts.semiBold,
    color: colors.success,
  },
  addressText: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  cardActions: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: spacing.xs,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  iconPressed: {
    backgroundColor: colors.navySoft,
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing.md,
    paddingHorizontal: SCREEN_PADDING,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    alignItems: 'center',
  },
  barInner: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH - SCREEN_PADDING * 2,
  },
});
