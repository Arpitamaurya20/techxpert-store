import { Stack, useRouter, type Href } from 'expo-router';

import { IconButton } from '@/components/ui/IconButton';

type HeaderBackFallbackProps = {
  /** Where the back arrow goes when the screen was opened directly (e.g. a web refresh). */
  fallback: Href;
  accessibilityLabel?: string;
};

/**
 * Keeps a back arrow in the header even when there is no screen to go back
 * to, so a page opened from a link or refresh is never a dead end.
 */
export function HeaderBackFallback({ fallback, accessibilityLabel = 'Back' }: HeaderBackFallbackProps) {
  const router = useRouter();
  if (router.canGoBack()) return null;

  return (
    <Stack.Screen
      options={{
        headerLeft: () => (
          <IconButton
            icon="arrow-back"
            accessibilityLabel={accessibilityLabel}
            surface="light"
            onPress={() => router.replace(fallback)}
          />
        ),
      }}
    />
  );
}
