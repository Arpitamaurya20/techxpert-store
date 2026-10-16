import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ProductImage } from '@/components/store/ProductImage';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import type { Order, OrderStatus } from '@/types/order';
import { getCategoryIcon } from '@/utils/categoryIcon';
import { formatPrice } from '@/utils/format';

const MAX_THUMBS = 4;

const STATUS_STYLE: Record<OrderStatus, { label: string; color: string; background: string }> = {
  placed: { label: 'Placed', color: '#1D4ED8', background: '#E0EAFF' },
  confirmed: { label: 'Confirmed', color: '#1D4ED8', background: '#E0EAFF' },
  packed: { label: 'Packed', color: colors.warning, background: colors.warningSoft },
  shipped: { label: 'Shipped', color: colors.warning, background: colors.warningSoft },
  out_for_delivery: { label: 'Out for delivery', color: colors.warning, background: colors.warningSoft },
  delivered: { label: 'Delivered', color: colors.accent, background: colors.accentSoft },
  cancelled: { label: 'Cancelled', color: colors.error, background: colors.errorSoft },
  returned: { label: 'Returned', color: colors.textMuted, background: colors.surface },
};

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

type OrderCardProps = {
  order: Order;
  isReordering: boolean;
  /** Disables Reorder while another order is being added to the cart. */
  reorderDisabled: boolean;
  onReorder: (order: Order) => void;
};

export function OrderCard({ order, isReordering, reorderDisabled, onReorder }: OrderCardProps) {
  const [expanded, setExpanded] = useState(false);
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const status = order.status ? STATUS_STYLE[order.status] : null;
  const statusLabel = status?.label ?? order.statusLabel;
  const extraThumbs = order.items.length - MAX_THUMBS;
  const canReorder = order.items.length > 0;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.orderNumber} numberOfLines={1}>
            Order #{order.orderNumber}
          </Text>
          {order.placedAt ? (
            <Text style={styles.meta}>Placed on {dateFormatter.format(new Date(order.placedAt))}</Text>
          ) : null}
        </View>
        {statusLabel ? (
          <View style={[styles.statusPill, { backgroundColor: status?.background ?? colors.surface }]}>
            <Text style={[styles.statusText, { color: status?.color ?? colors.textMuted }]}>
              {statusLabel}
            </Text>
          </View>
        ) : null}
      </View>

      {order.items.length > 0 ? (
        <View style={styles.thumbRow}>
          {order.items.slice(0, MAX_THUMBS).map((item) => (
            <ProductImage
              key={item.productId}
              uri={item.imageUrl}
              fallbackIcon={getCategoryIcon(item.categoryId)}
              accessibilityLabel={item.name}
              iconSize={22}
              style={styles.thumb}
            />
          ))}
          {extraThumbs > 0 ? (
            <View style={[styles.thumb, styles.moreThumb]}>
              <Text style={styles.moreText}>+{extraThumbs}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <Text style={styles.meta}>Item details are not available for this order.</Text>
      )}

      <View style={styles.summaryRow}>
        <Text style={styles.summaryText}>
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
          {order.total !== undefined ? '  ·  ' : ''}
          {order.total !== undefined ? <Text style={styles.total}>{formatPrice(order.total)}</Text> : null}
        </Text>
        {order.items.length > 0 ? (
          <Pressable
            onPress={() => setExpanded((value) => !value)}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={expanded ? 'Hide items' : 'View items'}
            hitSlop={8}
            style={styles.toggle}
          >
            <Text style={styles.toggleText}>{expanded ? 'Hide items' : 'View items'}</Text>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.homeInk} />
          </Pressable>
        ) : null}
      </View>

      {expanded ? (
        <View style={styles.itemList}>
          {order.items.map((item) => (
            <View key={item.productId} style={styles.itemRow}>
              <Text style={styles.itemName} numberOfLines={2}>
                {item.name}
                {item.unit ? <Text style={styles.meta}> · {item.unit}</Text> : null}
              </Text>
              <Text style={styles.itemQty}>× {item.quantity}</Text>
            </View>
          ))}
          <Text style={styles.note}>Reorder adds these items at today&apos;s price and availability.</Text>
        </View>
      ) : null}

      {canReorder ? (
        <Pressable
          onPress={() => onReorder(order)}
          disabled={reorderDisabled}
          accessibilityRole="button"
          accessibilityLabel={`Reorder items from order ${order.orderNumber}`}
          accessibilityState={{ disabled: reorderDisabled, busy: isReordering }}
          style={({ pressed }) => [
            styles.reorderButton,
            pressed && styles.reorderPressed,
            reorderDisabled && !isReordering && styles.reorderDisabled,
          ]}
        >
          {isReordering ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Ionicons name="refresh" size={18} color={colors.white} />
          )}
          <Text style={styles.reorderText}>{isReordering ? 'Adding to cart…' : 'Reorder'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: fonts.bold,
    color: colors.homeInk,
  },
  meta: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  statusPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  statusText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fonts.semiBold,
  },
  thumbRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: '#F5F6F8',
  },
  moreThumb: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.homeInk,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  summaryText: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  total: {
    fontFamily: fonts.bold,
    color: colors.homeInk,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  toggleText: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.semiBold,
    color: colors.homeInk,
  },
  itemList: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.regular,
    color: colors.homeInk,
  },
  itemQty: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.semiBold,
    color: colors.homeInk,
  },
  note: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  reorderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  reorderPressed: {
    backgroundColor: colors.accentPressed,
  },
  reorderDisabled: {
    opacity: 0.5,
  },
  reorderText: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: fonts.semiBold,
    color: colors.white,
  },
});
