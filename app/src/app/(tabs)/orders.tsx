import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DemoDataNotice } from '@/components/store/DemoDataNotice';
import { HomeProductSection } from '@/components/store/HomeProductSection';
import { OrderCard } from '@/components/store/OrderCard';
import { StoreHeader } from '@/components/store/StoreHeader';
import { Button } from '@/components/ui/Button';
import { StateView } from '@/components/ui/StateView';
import { MAX_STORE_WIDTH, SCREEN_PADDING, colors, fonts, radius, spacing } from '@/constants/theme';
import type { HomeProductSectionConfig } from '@/data/homeSections';
import { useAddToCart } from '@/hooks/useAddToCart';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useReorder } from '@/hooks/useReorder';
import { useStatusBarStyle } from '@/hooks/useStatusBarStyle';
import { useStoreLayout } from '@/hooks/useStoreLayout';
import { getErrorMessage } from '@/services/apiClient';
import { isApiConfigured } from '@/services/apiConfig';
import { getOrders } from '@/services/orderApi';
import { useSession } from '@/state/sessionStore';
import type { Product } from '@/types/catalog';

const reorderArt = require('../../../assets/images/reorder-empty.jpg');

const SUGGESTED_SECTION: HomeProductSectionConfig = {
  id: 'orders-featured',
  title: 'Featured Products',
  query: { featured: true },
};

export default function OrdersScreen() {
  useStatusBarStyle('dark');
  const router = useRouter();
  const layout = useStoreLayout();
  const session = useSession();
  const handleAddToCart = useAddToCart();
  const { reorder, reorderingId } = useReorder();
  const [refreshKey, setRefreshKey] = useState(0);

  const orders = useAsyncData(`orders-${session?.user.id ?? 'guest'}`, getOrders);
  const result = orders.data;

  const refreshAll = () => {
    orders.refresh();
    setRefreshKey((key) => key + 1);
  };

  const openProduct = useCallback(
    (product: Product) => router.push({ pathname: '/products/[id]', params: { id: product.id } }),
    [router]
  );

  const renderHistory = () => {
    if (orders.status === 'loading') {
      return <StateView variant="loading" compact message="Loading your orders…" />;
    }
    if (orders.status === 'error') {
      return (
        <StateView
          variant="error"
          compact
          title="Couldn't load your orders"
          message={getErrorMessage(orders.error)}
          actionLabel="Try Again"
          onAction={orders.reload}
        />
      );
    }
    if (result?.state === 'signed_out') {
      return (
        <View style={styles.signInCard}>
          <Ionicons name="person-circle-outline" size={40} color={colors.homeInk} />
          <Text style={styles.emptyTitle}>Sign in to see your orders</Text>
          <Text style={styles.emptyMessage}>
            Your past orders and quick reorder will appear here once you sign in.
          </Text>
          <Button title="Sign In" icon="log-in-outline" onPress={() => router.push('/login')} />
        </View>
      );
    }
    if (result?.state === 'ready' && result.orders.length > 0) {
      return (
        <View style={styles.orderList}>
          {result.orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              isReordering={reorderingId === order.id}
              reorderDisabled={reorderingId !== null}
              onReorder={reorder}
            />
          ))}
        </View>
      );
    }
    return (
      <View style={styles.emptyCard}>
        <Image
          source={reorderArt}
          style={styles.emptyArt}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          accessible={false}
        />
        <View style={styles.emptyText}>
          <Text style={styles.emptyTitle} accessibilityRole="header">
            Reordering will be easy
          </Text>
          <Text style={styles.emptyMessage}>
            Items you order will show up here so you can buy them again easily.
          </Text>
        </View>
      </View>
    );
  };

  const orderCount = result?.state === 'ready' ? result.orders.length : 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      stickyHeaderIndices={[0]}
      refreshControl={
        <RefreshControl
          refreshing={orders.isRefreshing}
          onRefresh={refreshAll}
          colors={[colors.orange]}
          tintColor={colors.navy}
          progressBackgroundColor={colors.card}
        />
      }
    >
      <StoreHeader />

      <View style={styles.body}>
        <View style={styles.historySection}>
          <View style={styles.titleRow}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              Your Orders
            </Text>
            {orderCount > 0 ? (
              <Text style={styles.countText}>
                {orderCount} {orderCount === 1 ? 'order' : 'orders'}
              </Text>
            ) : null}
          </View>
          {renderHistory()}
          {!isApiConfigured ? (
            <DemoDataNotice message="Order history appears here once the Techxpert store is connected. No sample orders are shown." />
          ) : null}
        </View>

        <HomeProductSection
          section={SUGGESTED_SECTION}
          cardWidth={layout.productCardWidth}
          refreshKey={refreshKey}
          onOpenProduct={openProduct}
          onAddToCart={handleAddToCart}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  body: {
    width: '100%',
    maxWidth: MAX_STORE_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: spacing.xl,
    gap: spacing.xl,
  },
  historySection: {
    gap: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: fonts.bold,
    color: colors.homeInk,
  },
  countText: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  orderList: {
    gap: spacing.md,
  },
  emptyCard: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    backgroundColor: '#FDF4D7',
  },
  emptyArt: {
    width: '100%',
    height: 190,
  },
  emptyText: {
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    lineHeight: 28,
    fontFamily: fonts.bold,
    color: colors.homeInk,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.regular,
    color: colors.homeInkMuted,
    textAlign: 'center',
  },
  signInCard: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
});
