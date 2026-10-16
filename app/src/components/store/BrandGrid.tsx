import { StyleSheet, View } from 'react-native';

import { BrandTile } from '@/components/store/BrandTile';
import { spacing } from '@/constants/theme';
import { GRID_GAP } from '@/hooks/useStoreLayout';
import type { Brand } from '@/types/catalog';

type BrandGridProps = {
  brands: Brand[];
  tileWidth: number;
  onPress: (brand: Brand) => void;
};

export function BrandGrid({ brands, tileWidth, onPress }: BrandGridProps) {
  return (
    <View style={styles.grid}>
      {brands.map((brand) => (
        <BrandTile key={brand.id} brand={brand} width={tileWidth} onPress={onPress} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: GRID_GAP,
    rowGap: spacing.md,
  },
});
