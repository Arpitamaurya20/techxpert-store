import { Linking } from 'react-native';

import { SettingsRow } from '@/components/ui/SettingsRow';
import { SUPPORT } from '@/constants/brand';
import { useAsyncData } from '@/hooks/useAsyncData';
import { isApiConfigured } from '@/services/apiConfig';
import { getHelpContent } from '@/services/cmsApi';

function whatsappUrl(value: string) {
  const digits = value.replace(/[^\d]/g, '');
  return digits ? `https://wa.me/${digits}` : '';
}

/** Call, WhatsApp and email rows. Uses the published help page when the server is connected. */
export function SupportContactRows() {
  const help = useAsyncData('cms-help', getHelpContent);
  const live = help.data?.source === 'live' ? help.data.data : null;
  if (isApiConfigured && help.status === 'loading' && !help.data) return null;

  const phone = live ? live.phone : SUPPORT.phone;
  const phoneLabel = live ? live.phoneLabel || live.phone : SUPPORT.phoneLabel;
  const email = live ? live.email : SUPPORT.email;
  const whatsapp = live?.whatsapp ? whatsappUrl(live.whatsapp) : '';
  const rows = [
    phone
      ? { key: 'phone', icon: 'call-outline' as const, label: 'Call', value: phoneLabel || phone, url: `tel:${phone}` }
      : null,
    whatsapp
      ? { key: 'whatsapp', icon: 'logo-whatsapp' as const, label: 'WhatsApp', value: live?.whatsapp ?? '', url: whatsapp }
      : null,
    email
      ? { key: 'email', icon: 'mail-outline' as const, label: 'Email', value: email, url: `mailto:${email}` }
      : null,
  ].filter((row) => row !== null);

  if (rows.length === 0) return null;

  return (
    <>
      {rows.map((row, index) => (
        <SettingsRow
          key={row.key}
          icon={row.icon}
          label={row.label}
          value={row.value}
          isLast={index === rows.length - 1}
          onPress={() => Linking.openURL(row.url)}
        />
      ))}
    </>
  );
}
