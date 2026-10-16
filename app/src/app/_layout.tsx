import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from '@expo-google-fonts/poppins';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { ToastProvider } from '@/components/ui/Toast';
import { BRAND } from '@/constants/brand';
import { colors, fonts } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

const SETTINGS_HEADER = {
  headerTitleAlign: 'center',
  headerStyle: { backgroundColor: colors.background },
} as const;

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });
  // A failed font download should fall back to the system font, not block the app.
  const ready = fontsLoaded || fontError != null;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <ToastProvider>
      <Stack
        screenOptions={{
          headerTintColor: colors.primary,
          headerTitleStyle: { fontFamily: fonts.bold },
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.surface },
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false, title: 'Sign In' }} />
        <Stack.Screen name="register" options={{ title: 'Create Account' }} />
        <Stack.Screen name="forgot-password" options={{ title: 'Forgot Password' }} />
        <Stack.Screen name="otp-login" options={{ title: 'Mobile OTP' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Store' }} />
        <Stack.Screen
          name="products/index"
          options={{ title: 'Products', contentStyle: { backgroundColor: colors.screen } }}
        />
        <Stack.Screen name="category/[id]" options={{ title: 'Category' }} />
        <Stack.Screen
          name="products/[id]"
          options={{ title: 'Product Details', contentStyle: { backgroundColor: colors.screen } }}
        />
        <Stack.Screen
          name="checkout"
          options={{ title: 'Checkout', contentStyle: { backgroundColor: colors.screen } }}
        />
        <Stack.Screen name="profile" options={{ ...SETTINGS_HEADER, title: 'Settings' }} />
        <Stack.Screen
          name="about/index"
          options={{ ...SETTINGS_HEADER, title: `About ${BRAND.fullName}` }}
        />
        <Stack.Screen name="about/us" options={{ ...SETTINGS_HEADER, title: 'About us' }} />
        <Stack.Screen name="about/contact" options={{ ...SETTINGS_HEADER, title: 'Contact us' }} />
        <Stack.Screen name="about/[policy]" options={{ ...SETTINGS_HEADER, title: 'Policy' }} />
        <Stack.Screen name="language" options={{ ...SETTINGS_HEADER, title: 'Language' }} />
        <Stack.Screen
          name="delivery-location"
          options={{ title: 'Delivery Location', presentation: 'modal' }}
        />
      </Stack>
    </ToastProvider>
  );
}
