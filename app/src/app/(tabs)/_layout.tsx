import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { colors, fonts } from '@/constants/theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

function tabIcon(active: IoniconName, inactive: IoniconName) {
  return function TabIcon({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) {
    return <Ionicons name={focused ? active : inactive} size={size} color={color} />;
  };
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.cardBorder, height: 64 },
        tabBarLabelStyle: { fontSize: 11, fontFamily: fonts.medium, marginBottom: 6 },
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: { fontFamily: fonts.bold, color: colors.primary },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.screen },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: 'Home', headerShown: false, tabBarIcon: tabIcon('home', 'home-outline') }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Order Again',
          headerShown: false,
          sceneStyle: { backgroundColor: colors.background },
          tabBarIcon: tabIcon('bag', 'bag-outline'),
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: 'Categories',
          headerShown: false,
          sceneStyle: { backgroundColor: colors.background },
          tabBarIcon: tabIcon('grid', 'grid-outline'),
        }}
      />
      <Tabs.Screen
        name="help"
        options={{
          title: 'Need help?',
          tabBarLabel: 'Help',
          tabBarIcon: tabIcon('chatbubble-ellipses', 'chatbubble-ellipses-outline'),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          href: null,
          title: 'My Cart',
        }}
      />
    </Tabs>
  );
}
