import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
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
import { HeaderCartButton } from '@/components/store/HeaderCartButton';
import { PriceTag } from '@/components/store/PriceTag';
import { ProductImageGallery } from '@/components/store/ProductImageGallery';
import { ProductSpecifications } from '@/components/store/ProductSpecifications';
import { StockBadge } from '@/components/store/StockBadge';
import { IconButton } from '@/components/ui/IconButton';
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
import { useAddToCart } from '@/hooks/useAddToCart';
import { useAsyncData } from '@/hooks/useAsyncData';
import { getErrorMessage } from '@/services/apiClient';
import { getProductById } from '@/services/productApi';
import {
  getAddableRange,
  getQuantityRules,
  useCartQuantity,
  type AddableRange,
} from '@/state/cartStore';
import type { CatalogResult, Product, ProductSpecification } from '@/types/catalog';
import { getCategoryIcon } from '@/utils/categoryIcon';

/** Used until the purchase bar reports its real height. */
const BAR_HEIGHT_ESTIMATE = 120;
const WIDE_LAYOUT_MIN_WIDTH = 900;
const DESCRIPTION_PREVIEW_CHARS = 280;
const DESCRIPTION_PREVIEW_LINES = 6;

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

  const [barHeight, setBarHeight] = useState(BAR_HEIGHT_ESTIMATE);
  const toastBottomOffset = Math.max(barHeight - insets.bottom, 0) + spacing.sm;
  const handleAddToCart = useAddToCart({ toastBottomOffset });

  const result = useAsyncData(`product-${id}`, () => (id ? getProductById(id) : NOT_FOUND));
  // Never show a previously opened product while a new id is loading.
  const loadedProduct = result.data?.data ?? null;
  const product = loadedProduct && loadedProduct.id === id ? loadedProduct : null;
  const isLoading = result.status === 'loading' || (loadedProduct !== null && product === null);

  const quantityInCart = useCartQuantity(id);
  const range = product ? getAddableRange(product, quantityInCart) : null;
  const [selected, setSelected] = useState<number | null>(null);
  const quantity = range ? fitQuantity(selected ?? range.min, range) : 0;
  const addingRef = useRef(false);

  const canGoBack = router.canGoBack();
  const goBackToListing = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else if (product?.categoryId) {
      router.replace({
        pathname: '/products',
        params: { categoryId: product.categoryId, categoryName: product.categoryName },
      });
    } else {
      router.replace('/home');
    }
  }, [router, product?.categoryId, product?.categoryName]);

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

  const header = (
    <Stack.Screen
      options={{
        title: 'Product Details',
        headerLeft: canGoBack
          ? undefined
          : () => (
              <IconButton
                icon="arrow-back"
                accessibilityLabel="Back to products"
                surface="light"
                onPress={goBackToListing}
              />
            ),
        headerRight: () => (
          <View style={styles.headerActions}>
            {shareUrl && canUseShareSheet() ? (
              <IconButton
                icon="share-social-outline"
                accessibilityLabel="Share product"
                surface="light"
                onPress={onShare}
              />
            ) : null}
            <HeaderCartButton />
          </View>
        ),
      }}
    />
  );

  if (isLoading) {
    return (
      <>
        {header}
        <DetailsSkeleton wide={width >= WIDE_LAYOUT_MIN_WIDTH} />
      </>
    );
  }

  if (result.status === 'error') {
    return (
      <>
        {header}
        <StateView
          variant="error"
          title="Couldn't load this product"
          message={getErrorMessage(result.error)}
          actionLabel="Try Again"
          onAction={result.reload}
        />
      </>
    );
  }

  if (!product) {
    return (
      <>
        {header}
        <StateView
          variant="empty"
          icon="cube-outline"
          title="Product not found"
          message="This product may have been removed from the catalogue, or the link is incorrect."
          actionLabel="Back to Products"
          onAction={goBackToListing}
        />
      </>
    );
  }

  const rules = getQuantityRules(product);
  const isOutOfStock = rules.max === 0;
  const isWide = width >= WIDE_LAYOUT_MIN_WIDTH;
  const gallery = [product.imageUrl, ...(product.images ?? [])].filter(
    (uri): uri is string => !!uri
  );

  const basicInfo: ProductSpecification[] = [
    product.brandName ? { label: 'Brand', value: product.brandName } : null,
    product.sku ? { label: 'SKU', value: product.sku } : null,
    product.categoryName ? { label: 'Category', value: product.categoryName } : null,
    product.unit ? { label: 'Pack size', value: product.unit } : null,
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

  const summary = (
    <View style={styles.card}>
      <Text style={styles.name} accessibilityRole="header">
        {product.name}
      </Text>

      <View style={styles.priceRow}>
        <PriceTag price={product.price} originalPrice={product.originalPrice} size="large" />
        {product.price !== undefined && product.unit ? (
          <Text style={styles.perUnit}>per {product.unit}</Text>
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

      {purchaseNotes.length > 0 ? (
        <Text style={styles.muted}>{purchaseNotes.join(' · ')}</Text>
      ) : null}

      {basicInfo.length > 0 ? <ProductSpecifications items={basicInfo} /> : null}
    </View>
  );

  return (
    <>
      {header}
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: barHeight + spacing.lg }]}
        >
          <View style={styles.inner}>
            {result.data?.source === 'demo' ? <DemoDataNotice /> : null}

            <View style={[styles.top, isWide && styles.topWide]}>
              <View style={isWide ? styles.column : undefined}>
                <ProductImageGallery
                  images={gallery}
                  productName={product.name}
                  localSource={getDemoProductArt(product.id)}
                  fallbackIcon={getCategoryIcon(product.categoryId)}
                />
              </View>
              <View style={isWide ? styles.column : undefined}>{summary}</View>
            </View>

            {product.description ? <DescriptionCard text={product.description} /> : null}

            {product.specifications?.length ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle} accessibilityRole="header">
                  Specifications
                </Text>
                <ProductSpecifications items={product.specifications} />
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
                style={({ pressed }) => [styles.card, styles.linkRow, pressed && styles.linkPressed]}
              >
                <Text style={styles.linkText}>More in {product.categoryName}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        </ScrollView>

        <AddToCartBar
          productName={product.name}
          price={product.price}
          range={range}
          quantity={quantity}
          onQuantityChange={setSelected}
          onAdd={onAdd}
          blockedTitle={blocked.title}
          blockedMessage={blocked.message}
          onLayout={onBarLayout}
        />
      </View>
    </>
  );
}

function DescriptionCard({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > DESCRIPTION_PREVIEW_CHARS || text.split('\n').length > DESCRIPTION_PREVIEW_LINES;

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        Product Description
      </Text>
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

function DetailsSkeleton({ wide }: { wide: boolean }) {
  return (
    <View
      style={[styles.content, styles.inner]}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading product"
    >
      <View style={[styles.top, wide && styles.topWide]}>
        <View style={[styles.skeletonImage, wide && styles.column]} />
        <View style={[styles.card, wide && styles.column]}>
          <View style={[styles.skeletonLine, { width: '80%', height: 20 }]} />
          <View style={[styles.skeletonLine, { width: '55%', height: 20 }]} />
          <View style={[styles.skeletonLine, { width: '30%', height: 26, marginTop: spacing.sm }]} />
          <View style={[styles.skeletonLine, { width: '25%' }]} />
        </View>
      </View>
      <View style={styles.card}>
        <View style={[styles.skeletonLine, { width: '45%', height: 16 }]} />
        <View style={[styles.skeletonLine, { width: '100%' }]} />
        <View style={[styles.skeletonLine, { width: '90%' }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screen,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    padding: SCREEN_PADDING,
  },
  inner: {
    width: '100%',
    maxWidth: MAX_STORE_WIDTH,
    alignSelf: 'center',
    gap: spacing.md,
  },
  top: {
    gap: spacing.md,
  },
  topWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  column: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    gap: spacing.xs,
    ...cardShadow,
  },
  name: {
    ...typography.title,
    fontSize: 20,
    lineHeight: 28,
    color: colors.text,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    columnGap: spacing.sm,
    marginTop: spacing.xs,
  },
  perUnit: {
    ...typography.caption,
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
  sectionTitle: {
    ...typography.label,
    fontSize: 16,
    color: colors.text,
  },
  description: {
    ...typography.body,
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
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
  },
  linkPressed: {
    backgroundColor: colors.surface,
  },
  linkText: {
    ...typography.label,
    color: colors.text,
  },
  skeletonImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    maxHeight: 420,
    borderRadius: radius.lg,
    backgroundColor: '#EDF1F5',
  },
  skeletonLine: {
    height: 12,
    marginVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EDF1F5',
  },
});
