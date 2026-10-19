import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddToCartBar } from '@/components/store/AddToCartBar';
import { DemoDataNotice } from '@/components/store/DemoDataNotice';
import { ProductImageGallery } from '@/components/store/ProductImageGallery';
import { ProductSpecifications } from '@/components/store/ProductSpecifications';
import { QuantitySelector } from '@/components/store/QuantitySelector';
import { StockBadge } from '@/components/store/StockBadge';
import { WishlistButton } from '@/components/store/WishlistButton';
import { StateView } from '@/components/ui/StateView';
import { useToast } from '@/components/ui/Toast';
import {
  MAX_STORE_WIDTH,
  SCREEN_PADDING,
  cardShadow,
  colors,
  fonts,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { getDemoProductArt } from '@/data/demoProductArt';
import { withSampleExtras } from '@/data/sampleProductExtras';
import { useAddToCart } from '@/hooks/useAddToCart';
import { useAsyncData } from '@/hooks/useAsyncData';
import { getErrorMessage } from '@/services/apiClient';
import { getProductById } from '@/services/productApi';
import {
  getAddableRange,
  getQuantityRules,
  useCartCount,
  useCartQuantity,
  type AddableRange,
} from '@/state/cartStore';
import { addRecentlyViewed } from '@/state/recentlyViewedStore';
import type { CatalogResult, Product, ProductSpecification } from '@/types/catalog';
import { getCategoryIcon } from '@/utils/categoryIcon';
import { discountPercent, formatPrice } from '@/utils/format';

/** Used until the purchase bar reports its real height. */
const BAR_HEIGHT_ESTIMATE = 96;
const WIDE_LAYOUT_MIN_WIDTH = 900;
const DESCRIPTION_PREVIEW_CHARS = 280;
const DESCRIPTION_PREVIEW_LINES = 6;
const TOP_BAR_HEIGHT = 56;
const STAR_COLOR = '#F5A623';

const NOT_FOUND: Promise<CatalogResult<Product | null>> = Promise.resolve({ data: null, source: 'api' });

/** Keeps the chosen quantity on an allowed value as the cart or limits change. */
function fitQuantity(value: number, range: AddableRange): number {
  const stepped = range.min + Math.round((value - range.min) / range.step) * range.step;
  return Math.max(range.min, Math.min(stepped, range.max));
}

function canUseShareSheet() {
  if (Platform.OS !== 'web') return true;
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export default function ProductDetailsScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id.trim() : '';
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const cartCount = useCartCount();

  const [barHeight, setBarHeight] = useState(BAR_HEIGHT_ESTIMATE);
  const [scrolled, setScrolled] = useState(false);
  const toastBottomOffset = Math.max(barHeight - insets.bottom, 0) + spacing.sm;
  const handleAddToCart = useAddToCart({ toastBottomOffset });

  const result = useAsyncData(`product-${id}`, () => (id ? getProductById(id) : NOT_FOUND));
  // Never show a previously opened product while a new id is loading.
  const loadedProduct = result.data?.data ?? null;
  const product = loadedProduct && loadedProduct.id === id ? loadedProduct : null;
  const isLoading = result.status === 'loading' || (loadedProduct !== null && product === null);
  const isSample = result.data?.source === 'demo';
  const viewedId = product?.id;

  useEffect(() => {
    if (viewedId) addRecentlyViewed(viewedId);
  }, [viewedId]);

  const quantityInCart = useCartQuantity(id);
  const range = product ? getAddableRange(product, quantityInCart) : null;
  const [selected, setSelected] = useState<number | null>(null);
  const quantity = range ? fitQuantity(selected ?? range.min, range) : 0;
  const addingRef = useRef(false);

  const categoryId = product?.categoryId;
  const categoryName = product?.categoryName;
  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else if (categoryId) {
      router.replace({ pathname: '/products', params: { categoryId, categoryName } });
    } else {
      router.replace('/home');
    }
  }, [router, categoryId, categoryName]);

  const onBarLayout = useCallback((event: LayoutChangeEvent) => {
    setBarHeight(Math.round(event.nativeEvent.layout.height));
  }, []);

  const shareUrl = product?.shareUrl;
  const productName = product?.name;
  const onShare = useCallback(async () => {
    if (!shareUrl || !productName) return;
    try {
      await Share.share(
        Platform.OS === 'android'
          ? { title: productName, message: `${productName}\n${shareUrl}` }
          : { title: productName, message: productName, url: shareUrl }
      );
    } catch (error) {
      // Closing the web share sheet rejects with AbortError; that is not a failure.
      if (error instanceof Error && error.name === 'AbortError') return;
      showToast({
        variant: 'error',
        message: "Couldn't open the share options on this device.",
        bottomOffset: toastBottomOffset,
      });
    }
  }, [shareUrl, productName, showToast, toastBottomOffset]);

  const onAdd = () => {
    if (!product || !range || addingRef.current) return;
    addingRef.current = true;
    try {
      const outcome = handleAddToCart(product, quantity);
      if (outcome.ok) setSelected(null);
    } finally {
      addingRef.current = false;
    }
  };

  const topBar = (
    <View
      style={[styles.topBar, scrolled && styles.topBarSolid, { paddingTop: insets.top + spacing.sm }]}
      pointerEvents="box-none"
    >
      <CircleButton icon="arrow-back" label="Go back" onPress={goBack} />
      <View style={styles.topActions}>
        {product ? <WishlistButton productId={product.id} productName={product.name} size="large" /> : null}
        <CircleButton
          icon="cart-outline"
          label={cartCount > 0 ? `Cart, ${cartCount} items` : 'Cart'}
          badgeCount={cartCount}
          onPress={() => router.navigate('/cart')}
        />
        {shareUrl && canUseShareSheet() ? (
          <CircleButton icon="share-social-outline" label="Share product" onPress={onShare} />
        ) : null}
      </View>
    </View>
  );

  const statePadding = { paddingTop: insets.top + TOP_BAR_HEIGHT };

  if (isLoading) {
    return (
      <View style={[styles.screen, statePadding]}>
        <Stack.Screen options={{ headerShown: false }} />
        <DetailsSkeleton />
        {topBar}
      </View>
    );
  }

  if (result.status === 'error' || !product) {
    return (
      <View style={[styles.screen, statePadding]}>
        <Stack.Screen options={{ headerShown: false }} />
        {result.status === 'error' ? (
          <StateView
            variant="error"
            title="Couldn't load this product"
            message={getErrorMessage(result.error)}
            actionLabel="Try Again"
            onAction={result.reload}
          />
        ) : (
          <StateView
            variant="empty"
            icon="cube-outline"
            title="Product not found"
            message="This product may have been removed from the catalogue, or the link is incorrect."
            actionLabel="Back to Products"
            onAction={goBack}
          />
        )}
        {topBar}
      </View>
    );
  }

  const display = isSample ? withSampleExtras(product) : product;
  const rules = getQuantityRules(product);
  const isOutOfStock = rules.max === 0;
  const isWide = width >= WIDE_LAYOUT_MIN_WIDTH;
  const discount = product.price !== undefined ? discountPercent(product.price, display.originalPrice) : undefined;
  const gallery = [product.imageUrl, ...(product.images ?? [])].filter(
    (uri): uri is string => !!uri
  );

  const details: ProductSpecification[] = [
    product.brandName ? { label: 'Brand', value: product.brandName } : null,
    product.sku ? { label: 'SKU', value: product.sku } : null,
    product.categoryName ? { label: 'Category', value: product.categoryName } : null,
    ...(product.specifications ?? []),
  ].filter((item): item is ProductSpecification => item !== null);

  const purchaseNotes = [
    rules.min > 1 ? `Minimum order: ${rules.min}` : null,
    rules.step > 1 ? `Sold in multiples of ${rules.step}` : null,
    product.maxOrderQuantity ? `Maximum ${product.maxOrderQuantity} per order` : null,
  ].filter((note): note is string => note !== null);

  const blocked = isOutOfStock
    ? { title: 'Out of Stock', message: 'This item is out of stock and cannot be added to the cart.' }
    : product.price === undefined
      ? {
          title: 'Price Unavailable',
          message: 'This item has no published price yet, so it cannot be added to the cart.',
        }
      : quantityInCart > 0
        ? {
            title: 'Maximum in Cart',
            message: `You already have the maximum quantity (${quantityInCart}) in your cart.`,
          }
        : {
            title: 'Not Available',
            message: `Available stock is below the minimum order of ${rules.min}.`,
          };

  const info = (
    <View style={styles.info}>
      <Text style={styles.name} accessibilityRole="header">
        {product.name}
      </Text>

      {display.rating !== undefined ? (
        <View style={styles.ratingRow} accessible accessibilityLabel={ratingLabel(display, isSample)}>
          <Stars rating={display.rating} />
          <Text style={styles.ratingText}>
            {display.rating.toFixed(1)}
            {display.reviewCount ? ` (${display.reviewCount.toLocaleString('en-IN')} reviews)` : ''}
          </Text>
          {isSample ? <SampleTag /> : null}
        </View>
      ) : null}

      <View style={styles.priceBlock}>
        {product.price !== undefined ? (
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPrice(product.price)}</Text>
            {discount && display.originalPrice ? (
              <>
                <Text
                  style={styles.mrp}
                  accessibilityLabel={`${isSample ? 'Sample ' : ''}MRP ${formatPrice(display.originalPrice)}`}
                >
                  {formatPrice(display.originalPrice)}
                </Text>
                <View style={styles.offPill}>
                  <Text style={styles.offText}>{discount}% OFF</Text>
                </View>
              </>
            ) : null}
          </View>
        ) : (
          <Text style={styles.priceUnavailable}>Price unavailable</Text>
        )}
        {product.price !== undefined && product.unit ? (
          <Text style={styles.muted}>per {product.unit}</Text>
        ) : null}
      </View>

      <View style={styles.availability}>
        {product.stockStatus ? (
          <StockBadge product={product} />
        ) : (
          <Text style={styles.muted}>Availability information unavailable</Text>
        )}
        {quantityInCart > 0 ? (
          <View style={styles.inCartRow}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.inCartText}>{quantityInCart} in your cart</Text>
          </View>
        ) : null}
      </View>

      {product.description ? <Description text={product.description} /> : null}

      {display.highlights?.length ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              Key Features
            </Text>
            {isSample ? <SampleTag /> : null}
          </View>
          {display.highlights.map((item) => (
            <View key={item} style={styles.featureRow}>
              <Ionicons name="checkmark" size={18} color={colors.success} />
              <Text style={styles.featureText}>{item}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {product.unit ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Size
          </Text>
          <View style={styles.sizeChip} accessibilityLabel={`Size ${product.unit}`}>
            <Text style={styles.sizeText}>{product.unit}</Text>
          </View>
        </View>
      ) : null}

      {range ? (
        <View style={styles.quantityRow}>
          <Text style={styles.sectionTitle}>Quantity</Text>
          <QuantitySelector
            value={quantity}
            min={range.min}
            max={range.max}
            step={range.step}
            onChange={setSelected}
            itemName={product.name}
          />
        </View>
      ) : null}
      {purchaseNotes.length > 0 ? <Text style={styles.muted}>{purchaseNotes.join(' · ')}</Text> : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: barHeight + spacing.lg }}
        onScroll={(event) => setScrolled(event.nativeEvent.contentOffset.y > 8)}
        scrollEventThrottle={64}
      >
        <View style={[styles.inner, isWide && styles.innerWide, { paddingTop: insets.top }]}>
          <View style={isWide ? styles.column : undefined}>
            <View style={isWide ? { paddingTop: TOP_BAR_HEIGHT } : undefined}>
              <ProductImageGallery
                bare
                images={gallery}
                productName={product.name}
                localSource={getDemoProductArt(product.id)}
                fallbackIcon={getCategoryIcon(product.categoryId)}
              />
            </View>
          </View>
          <View style={[styles.body, isWide && styles.column, isWide && { paddingTop: TOP_BAR_HEIGHT }]}>
            {info}

            {details.length > 0 ? (
              <View style={styles.detailsCard}>
                <Text style={styles.sectionTitle} accessibilityRole="header">
                  Product Details
                </Text>
                <ProductSpecifications items={details} />
              </View>
            ) : null}

            {product.categoryId && product.categoryName ? (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/products',
                    params: { categoryId: product.categoryId, categoryName: product.categoryName },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`View more products in ${product.categoryName}`}
                style={({ pressed }) => [styles.linkRow, pressed && styles.linkPressed]}
              >
                <Text style={styles.linkText}>More in {product.categoryName}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.navy} />
              </Pressable>
            ) : null}

            {isSample ? <DemoDataNotice /> : null}
          </View>
        </View>
      </ScrollView>

      {topBar}

      <AddToCartBar
        price={product.price}
        canAdd={range !== null}
        quantity={quantity}
        onAdd={onAdd}
        blockedTitle={blocked.title}
        blockedMessage={blocked.message}
        onLayout={onBarLayout}
      />
    </View>
  );
}

function ratingLabel(product: Product, isSample: boolean) {
  const parts = [`${isSample ? 'Sample rating' : 'Rated'} ${product.rating?.toFixed(1)} out of 5`];
  if (product.reviewCount) parts.push(`${product.reviewCount} reviews`);
  return parts.join(', ');
}

function Stars({ rating }: { rating: number }) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((position) => {
        const name =
          rating >= position ? 'star' : rating >= position - 0.5 ? 'star-half' : 'star-outline';
        return <Ionicons key={position} name={name} size={14} color={STAR_COLOR} />;
      })}
    </View>
  );
}

function SampleTag() {
  return (
    <View style={styles.sampleTag}>
      <Text style={styles.sampleText}>SAMPLE</Text>
    </View>
  );
}

type CircleButtonProps = {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  badgeCount?: number;
};

function CircleButton({ icon, label, onPress, badgeCount = 0 }: CircleButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [styles.circle, pressed && styles.circlePressed]}
    >
      <Ionicons name={icon} size={20} color={colors.navy} />
      {badgeCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function Description({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > DESCRIPTION_PREVIEW_CHARS || text.split('\n').length > DESCRIPTION_PREVIEW_LINES;

  return (
    <View>
      <Text
        style={styles.description}
        numberOfLines={isLong && !expanded ? DESCRIPTION_PREVIEW_LINES : undefined}
      >
        {text}
      </Text>
      {isLong ? (
        <Pressable
          onPress={() => setExpanded((value) => !value)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          hitSlop={8}
          style={({ pressed }) => [styles.readMore, pressed && styles.readMorePressed]}
        >
          <Text style={styles.readMoreText}>{expanded ? 'Read Less' : 'Read More'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function DetailsSkeleton() {
  return (
    <View style={styles.inner} accessibilityRole="progressbar" accessibilityLabel="Loading product">
      <View style={styles.skeletonImage} />
      <View style={styles.body}>
        <View style={[styles.skeletonLine, { width: '75%', height: 20 }]} />
        <View style={[styles.skeletonLine, { width: '40%' }]} />
        <View style={[styles.skeletonLine, { width: '30%', height: 26, marginTop: spacing.sm }]} />
        <View style={[styles.skeletonLine, { width: '100%' }]} />
        <View style={[styles.skeletonLine, { width: '90%' }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.card,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: spacing.sm,
  },
  topBarSolid: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  topActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  circle: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...cardShadow,
  },
  circlePressed: {
    backgroundColor: colors.navySoft,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.card,
    backgroundColor: colors.accent,
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 13,
    fontFamily: fonts.semiBold,
    color: colors.white,
  },
  inner: {
    width: '100%',
    maxWidth: MAX_STORE_WIDTH,
    alignSelf: 'center',
  },
  innerWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xl,
    paddingHorizontal: SCREEN_PADDING,
  },
  column: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  body: {
    paddingHorizontal: SCREEN_PADDING,
    gap: spacing.lg,
  },
  info: {
    gap: spacing.md,
  },
  name: {
    fontSize: 21,
    lineHeight: 28,
    fontFamily: fonts.bold,
    color: colors.navy,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: -spacing.sm,
  },
  stars: {
    flexDirection: 'row',
    gap: 1,
  },
  ratingText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  priceBlock: {
    gap: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  price: {
    fontSize: 26,
    lineHeight: 34,
    fontFamily: fonts.bold,
    color: colors.navy,
  },
  mrp: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  offPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.successSoft,
  },
  offText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.bold,
    color: colors.success,
  },
  priceUnavailable: {
    fontSize: 18,
    lineHeight: 32,
    fontFamily: fonts.semiBold,
    color: colors.textMuted,
  },
  availability: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: spacing.md,
    rowGap: spacing.xs,
  },
  muted: {
    ...typography.caption,
    color: colors.textMuted,
  },
  inCartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  inCartText: {
    ...typography.caption,
    fontFamily: fonts.semiBold,
    color: colors.success,
  },
  description: {
    ...typography.caption,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  readMore: {
    alignSelf: 'flex-start',
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    marginLeft: -spacing.xs,
    borderRadius: radius.sm,
  },
  readMorePressed: {
    backgroundColor: colors.surface,
  },
  readMoreText: {
    ...typography.label,
    color: colors.accent,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: fonts.bold,
    color: colors.navy,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featureText: {
    ...typography.caption,
    fontSize: 14,
    flex: 1,
    color: colors.text,
  },
  sizeChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.navy,
  },
  sizeText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.semiBold,
    color: colors.white,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sampleTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: colors.accentSoft,
  },
  sampleText: {
    fontSize: 10,
    lineHeight: 14,
    fontFamily: fonts.bold,
    letterSpacing: 0.5,
    color: colors.accent,
  },
  detailsCard: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  linkPressed: {
    backgroundColor: colors.surface,
  },
  linkText: {
    ...typography.label,
    color: colors.navy,
  },
  skeletonImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    maxHeight: 420,
    marginBottom: spacing.lg,
    backgroundColor: '#EDF1F5',
  },
  skeletonLine: {
    height: 12,
    marginVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EDF1F5',
  },
});
