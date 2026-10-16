import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { colors, fonts, noInputOutline, radius, spacing, typography } from '@/constants/theme';
import { formatPrice } from '@/utils/format';
import { EMPTY_FILTERS, type FilterOptions, type ProductFilters } from '@/utils/productListing';

type ProductFilterSheetProps = {
  options: FilterOptions;
  value: ProductFilters;
  onApply: (filters: ProductFilters) => void;
  onClose: () => void;
};

function toInput(value?: number) {
  return value === undefined ? '' : String(value);
}

function parsePrice(text: string) {
  return text === '' ? undefined : Number(text);
}

/**
 * Edits a draft copy of the filters; nothing changes on the listing until Apply.
 * Mount it only while open so each opening starts from the applied filters.
 */
export function ProductFilterSheet({ options, value, onApply, onClose }: ProductFilterSheetProps) {
  const [brands, setBrands] = useState(value.brands);
  const [minText, setMinText] = useState(toInput(value.minPrice));
  const [maxText, setMaxText] = useState(toInput(value.maxPrice));
  const [focusedPrice, setFocusedPrice] = useState<'min' | 'max' | null>(null);
  const [inStockOnly, setInStockOnly] = useState(value.inStockOnly);

  const minPrice = parsePrice(minText);
  const maxPrice = parsePrice(maxText);
  const priceError =
    minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice
      ? 'Minimum price cannot be more than the maximum.'
      : undefined;

  const toggleBrand = (key: string) =>
    setBrands((current) =>
      current.includes(key) ? current.filter((brand) => brand !== key) : [...current, key]
    );

  const clearAll = () => {
    onApply(EMPTY_FILTERS);
    onClose();
  };

  const apply = () => {
    onApply({ brands, minPrice, maxPrice, inStockOnly });
    onClose();
  };

  const footer = (
    <>
      <View style={styles.footerButton}>
        <Button title="Clear Filters" variant="outline" onPress={clearAll} />
      </View>
      <View style={styles.footerButton}>
        <Button title="Apply" onPress={apply} disabled={!!priceError} />
      </View>
    </>
  );

  return (
    <BottomSheet visible title="Filters" onClose={onClose} footer={footer}>
      {options.brands.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Brand</Text>
          <View style={styles.chips}>
            {options.brands.map((brand) => {
              const selected = brands.includes(brand.key);
              return (
                <Pressable
                  key={brand.key}
                  onPress={() => toggleBrand(brand.key)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  style={({ pressed }) => [
                    styles.chip,
                    selected && styles.chipSelected,
                    pressed && styles.chipPressed,
                  ]}
                >
                  {selected ? <Ionicons name="checkmark" size={14} color={colors.accent} /> : null}
                  <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                    {brand.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {options.priceRange ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Price (₹)</Text>
          <Text style={styles.hint}>
            Prices in this list: {formatPrice(options.priceRange.min)} – {formatPrice(options.priceRange.max)}
          </Text>
          <View style={styles.priceRow}>
            <TextInput
              value={minText}
              onChangeText={(text) => setMinText(text.replace(/\D/g, ''))}
              placeholder="Min"
              placeholderTextColor={colors.placeholder}
              keyboardType="number-pad"
              maxLength={7}
              accessibilityLabel="Minimum price in rupees"
              onFocus={() => setFocusedPrice('min')}
              onBlur={() => setFocusedPrice(null)}
              style={[
                styles.priceInput,
                focusedPrice === 'min' && styles.priceInputFocused,
                priceError && styles.priceInputError,
              ]}
            />
            <Text style={styles.priceDash}>to</Text>
            <TextInput
              value={maxText}
              onChangeText={(text) => setMaxText(text.replace(/\D/g, ''))}
              placeholder="Max"
              placeholderTextColor={colors.placeholder}
              keyboardType="number-pad"
              maxLength={7}
              accessibilityLabel="Maximum price in rupees"
              onFocus={() => setFocusedPrice('max')}
              onBlur={() => setFocusedPrice(null)}
              style={[
                styles.priceInput,
                focusedPrice === 'max' && styles.priceInputFocused,
                priceError && styles.priceInputError,
              ]}
            />
          </View>
          {priceError ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {priceError}
            </Text>
          ) : null}
        </View>
      ) : null}

      {options.hasStockInfo ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Availability</Text>
          <Pressable
            onPress={() => setInStockOnly((current) => !current)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: inStockOnly }}
            style={({ pressed }) => [styles.checkRow, pressed && styles.chipPressed]}
          >
            <Ionicons
              name={inStockOnly ? 'checkbox' : 'square-outline'}
              size={22}
              color={inStockOnly ? colors.accent : colors.textMuted}
            />
            <Text style={styles.checkLabel}>In stock only</Text>
          </Pressable>
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.text,
  },
  hint: {
    ...typography.small,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipLabel: {
    ...typography.caption,
    color: colors.text,
  },
  chipLabelSelected: {
    fontFamily: fonts.semiBold,
    color: colors.accent,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  priceInput: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.text,
    ...noInputOutline,
  },
  priceInputFocused: {
    borderColor: colors.accent,
  },
  priceInputError: {
    borderColor: colors.error,
  },
  priceDash: {
    ...typography.caption,
    color: colors.textMuted,
  },
  error: {
    ...typography.caption,
    color: colors.error,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    alignSelf: 'flex-start',
    paddingRight: spacing.md,
  },
  checkLabel: {
    ...typography.body,
    color: colors.text,
  },
  footerButton: {
    flex: 1,
  },
});
