import { Linking } from 'react-native';

import { SettingsRow } from '@/components/ui/SettingsRow';
import { SUPPORT } from '@/constants/brand';

/** Call and email rows for the published store contacts. */
export function SupportContactRows() {
  return (
    <>
      <SettingsRow
        icon="call-outline"
        label="Call"
        value={SUPPORT.phoneLabel}
        onPress={() => Linking.openURL(`tel:${SUPPORT.phone}`)}
      />
      <SettingsRow
        icon="mail-outline"
        label="Email"
        value={SUPPORT.email}
        isLast
        onPress={() => Linking.openURL(`mailto:${SUPPORT.email}`)}
      />
    </>
  );
}
