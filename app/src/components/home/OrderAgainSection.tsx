import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SCREEN_PADDING, colors, fonts, radius, spacing } from '@/constants/theme';
import type { Product } from '@/types/catalog';

import { RailProductCard } from './RailProductCard';
import { SectionHeader } from './SectionHeader';

/** "sample" before the store is connected, "signed_out" without a session, "orders" for real history. */
export type OrderAgainMode = 'sample' | 'signed_out' | 'orders';

type OrderAgainSectionProps = {
  status: 'loading' | 'success' | 'error';
  mode?: OrderAgainMode;
  products: Product[];
  onRetry: () => void;
  onOpenProduct: (product: Product) => void;
  onAdd: (product: Product, quantity: number) => void;
};

export function OrderAgainSection({
  status,
  mode,
  products,
  onRetry,
  onOpenProduct,
  onAdd,
}: OrderAgainSectionProps) {
  const router = useRouter();

  const renderBody = () => {
    if (status === 'loading') {
      return (
        <View style={styles.messageCard}>
          <ActivityIndicator color={colors.navy} />
        </View>
      );
    }
    if (status === 'error') {
      return (
        <View style={styles.messageCard}>
          <Text style={styles.messageText}>Couldn&apos;t load your past orders.</Text>
          <Pressable onPress={onRetry} accessibilityRole="button" style={styles.textButton}>
            <Text style={styles.textButtonLabel}>Try Again</Text>
          </Pressable>
        </View>
      );
    }
    if (mode === 'signed_out') {
      return (
        <View style={styles.signInCard}>
          <View style={styles.signInIcon}>
            <Ionicons name="refresh" size={22} color={colors.navy} />
          </View>
          <View style={styles.signInCopy}>
            <Text style={styles.signInTitle}>Reorder in one tap</Text>
            <Text style={styles.messageText}>Sign in to see items from your past orders.</Text>
          </View>
          <Pressable
            onPress={() => router.push('/login')}
            accessibilityRole="button"
            accessibilityLabel="Sign in to see your past orders"
            style={({ pressed }) => [styles.signInButton, pressed && styles.signInButtonPressed]}
          >
            <Text style={styles.signInButtonText}>Sign In</Text>
          </Pressable>
        </View>
      );
    }
    if (products.length === 0) {
      return (
        <View style={styles.messageCard}>
          <Text style={styles.messageText}>Items you order will show up here so you can buy them again.</Text>
        </View>
      );
    }
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroller}
        contentContainerStyle={styles.row}
      >
        {products.map((product) => (
          <RailProductCard key={product.id} product={product} onOpen={onOpenProduct} onAdd={onAdd} />
        ))}
      </ScrollView>
    );
  };

  return (
    <View style={styles.section}>
      <SectionHeader title="Order Again" actionLabel="View all" onAction={() => router.navigate('/orders')} />
      {renderBody()}
      {mode === 'sample' && status === 'success' ? (
        <Text style={styles.sampleNote}>Sample items · your own past orders appear here once you sign in.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  scroller: {
    marginHorizontal: -SCREEN_PADDING,
    flexGrow: 0,
  },
  row: {
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 4,
    gap: spacing.sm,
  },
  sampleNote: {
    fontSize: 10,
    lineHeight: 14,
    fontFamily: fonts.regular,
    color: colors.warning,
  },
  messageCard: {
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  messageText: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  textButton: {
    minHeight: 32,
    justifyContent: 'center',
  },
  textButtonLabel: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.orange,
  },
  signInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  signInIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: colors.navySoft,
  },
  signInCopy: {
    flex: 1,
  },
  signInTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.semiBold,
    color: colors.navy,
  },
  signInButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    backgroundColor: colors.navy,
  },
  signInButtonPressed: {
    backgroundColor: colors.navyDeep,
  },
  signInButtonText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.bold,
    color: colors.white,
  },
});
