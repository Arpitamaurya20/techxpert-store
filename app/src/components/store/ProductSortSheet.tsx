import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';
import { SORT_LABELS, type ProductSort } from '@/utils/productListing';

type ProductSortSheetProps = {
  visible: boolean;
  options: ProductSort[];
  value: ProductSort;
  onChange: (sort: ProductSort) => void;
  onClose: () => void;
};

export function ProductSortSheet({ visible, options, value, onChange, onClose }: ProductSortSheetProps) {
  return (
    <BottomSheet visible={visible} title="Sort by" onClose={onClose}>
      <View style={styles.list} accessibilityRole="radiogroup">
        {options.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              key={option}
              onPress={() => {
                onChange(option);
                onClose();
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              style={({ pressed }) => [
                styles.option,
                selected && styles.optionSelected,
                pressed && styles.optionPressed,
              ]}
            >
              <Text style={[styles.label, selected && styles.labelSelected]}>{SORT_LABELS[option]}</Text>
              <Ionicons
                name={selected ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={selected ? colors.accent : colors.disabled}
              />
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  optionSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  optionPressed: {
    backgroundColor: colors.surface,
  },
  label: {
    ...typography.body,
    color: colors.text,
  },
  labelSelected: {
    fontFamily: fonts.semiBold,
  },
});
