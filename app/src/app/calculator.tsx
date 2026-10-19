import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { HeaderBackFallback } from '@/components/ui/HeaderBackFallback';
import { MAX_CONTENT_WIDTH, SCREEN_PADDING, cardShadow, colors, fonts, radius, spacing } from '@/constants/theme';
import { useStatusBarStyle } from '@/hooks/useStatusBarStyle';
import {
  PAINT_COVERAGE_SQ_FT_PER_LITRE,
  TILE_SIZES,
  TILE_WASTAGE,
  estimateConcrete,
  estimatePaint,
  estimatePlaster,
  estimateTiles,
  type CalculatorMode,
  type CementWork,
} from '@/utils/materialEstimates';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const MODES: { id: CalculatorMode; label: string; icon: IoniconName; categoryId: string; shopLabel: string }[] = [
  { id: 'paint', label: 'Paint', icon: 'color-palette-outline', categoryId: 'paints-putty', shopLabel: 'Shop Paints' },
  { id: 'tiles', label: 'Tiles', icon: 'grid-outline', categoryId: 'tiling-grouts', shopLabel: 'Shop Tiles' },
  { id: 'cement', label: 'Cement', icon: 'cube-outline', categoryId: 'cement-plaster', shopLabel: 'Shop Cement' },
];

function toNumber(text: string) {
  const value = Number.parseFloat(text.replace(',', '.'));
  return Number.isFinite(value) ? value : 0;
}

type Result = { value: string; unit: string; lines: string[] } | null;

export default function CalculatorScreen() {
  useStatusBarStyle('dark');
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const initialMode = MODES.some((item) => item.id === params.mode) ? (params.mode as CalculatorMode) : 'paint';
  const [mode, setMode] = useState<CalculatorMode>(initialMode);

  const [paint, setPaint] = useState({ length: '12', width: '10', height: '10' });
  const [coats, setCoats] = useState(2);
  const [ceiling, setCeiling] = useState(false);

  const [floor, setFloor] = useState({ length: '12', width: '10', perBox: '' });
  const [tileId, setTileId] = useState(TILE_SIZES[1].id);

  const [work, setWork] = useState<CementWork>('plaster');
  const [plaster, setPlaster] = useState({ length: '10', height: '10' });
  const [plasterMm, setPlasterMm] = useState(12);
  const [sandParts, setSandParts] = useState(4);
  const [slab, setSlab] = useState({ length: '10', width: '10' });
  const [slabIn, setSlabIn] = useState(4);

  const active = MODES.find((item) => item.id === mode) ?? MODES[0];

  const result: Result = (() => {
    if (mode === 'paint') {
      const estimate = estimatePaint({
        length: toNumber(paint.length),
        width: toNumber(paint.width),
        height: toNumber(paint.height),
        coats,
        ceiling,
      });
      return estimate
        ? {
            value: String(estimate.litres),
            unit: 'litres of paint',
            lines: [`${estimate.areaSqFt} sq ft × ${coats} ${coats === 1 ? 'coat' : 'coats'}`],
          }
        : null;
    }
    if (mode === 'tiles') {
      const tile = TILE_SIZES.find((item) => item.id === tileId) ?? TILE_SIZES[0];
      const estimate = estimateTiles({
        length: toNumber(floor.length),
        width: toNumber(floor.width),
        tile,
        tilesPerBox: toNumber(floor.perBox),
      });
      return estimate
        ? {
            value: String(estimate.tiles),
            unit: `tiles (${tile.label})`,
            lines: [
              `${estimate.areaSqFt} sq ft + ${Math.round(TILE_WASTAGE * 100)}% for cutting and breakage`,
              ...(estimate.boxes ? [`About ${estimate.boxes} boxes`] : []),
            ],
          }
        : null;
    }
    const estimate =
      work === 'plaster'
        ? estimatePlaster({
            length: toNumber(plaster.length),
            height: toNumber(plaster.height),
            thicknessMm: plasterMm,
            sandParts,
          })
        : estimateConcrete({ length: toNumber(slab.length), width: toNumber(slab.width), thicknessIn: slabIn });
    return estimate
      ? {
          value: String(estimate.bags),
          unit: `cement ${estimate.bags === 1 ? 'bag' : 'bags'} (50 kg)`,
          lines: [
            estimate.areaOrVolume,
            `About ${estimate.sandCuFt} cu ft sand`,
            ...(estimate.aggregateCuFt ? [`About ${estimate.aggregateCuFt} cu ft aggregate (gitti)`] : []),
          ],
        }
      : null;
  })();

  const note =
    mode === 'paint'
      ? `Assumes about ${PAINT_COVERAGE_SQ_FT_PER_LITRE} sq ft per litre per coat. Doors and windows are not deducted, which leaves a small margin. Check the coverage printed on the pack.`
      : mode === 'tiles'
        ? 'Tiles per box differs by brand and size; enter it from the pack to see boxes.'
        : work === 'plaster'
          ? 'Includes 20% extra for uneven walls. Actual use depends on the wall and mason.'
          : 'For an M20 mix (1 : 1.5 : 3). Get structural work checked by your engineer.';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <HeaderBackFallback fallback="/home" accessibilityLabel="Back to Home" />
      <View style={styles.inner}>
        <View style={styles.tabs} accessibilityRole="tablist">
          {MODES.map((item) => {
            const selected = item.id === mode;
            return (
              <Pressable
                key={item.id}
                onPress={() => setMode(item.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                style={[styles.tab, selected && styles.tabSelected]}
              >
                <Ionicons name={item.icon} size={18} color={selected ? colors.white : colors.navy} />
                <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.card}>
          {mode === 'paint' ? (
            <>
              <Text style={styles.cardTitle}>Room size</Text>
              <View style={styles.fieldRow}>
                <NumberField label="Length" value={paint.length} onChange={(length) => setPaint({ ...paint, length })} />
                <NumberField label="Width" value={paint.width} onChange={(width) => setPaint({ ...paint, width })} />
                <NumberField label="Height" value={paint.height} onChange={(height) => setPaint({ ...paint, height })} />
              </View>
              <Text style={styles.label}>Coats</Text>
              <ChipGroup
                options={[1, 2, 3].map((value) => ({ id: value, label: String(value) }))}
                selected={coats}
                onSelect={setCoats}
              />
              <Pressable
                onPress={() => setCeiling((value) => !value)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: ceiling }}
                style={styles.checkRow}
              >
                <Ionicons
                  name={ceiling ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={ceiling ? colors.navy : colors.textMuted}
                />
                <Text style={styles.checkText}>Include ceiling</Text>
              </Pressable>
            </>
          ) : null}

          {mode === 'tiles' ? (
            <>
              <Text style={styles.cardTitle}>Floor or wall size</Text>
              <View style={styles.fieldRow}>
                <NumberField label="Length" value={floor.length} onChange={(length) => setFloor({ ...floor, length })} />
                <NumberField label="Width" value={floor.width} onChange={(width) => setFloor({ ...floor, width })} />
              </View>
              <Text style={styles.label}>Tile size</Text>
              <ChipGroup
                options={TILE_SIZES.map((tile) => ({ id: tile.id, label: tile.label }))}
                selected={tileId}
                onSelect={setTileId}
              />
              <NumberField
                label="Tiles per box (optional)"
                unit="pcs"
                value={floor.perBox}
                onChange={(perBox) => setFloor({ ...floor, perBox })}
              />
            </>
          ) : null}

          {mode === 'cement' ? (
            <>
              <Text style={styles.label}>Work</Text>
              <ChipGroup
                options={[
                  { id: 'plaster' as const, label: 'Wall plaster' },
                  { id: 'concrete' as const, label: 'Concrete slab (M20)' },
                ]}
                selected={work}
                onSelect={setWork}
              />
              {work === 'plaster' ? (
                <>
                  <View style={styles.fieldRow}>
                    <NumberField
                      label="Wall length"
                      value={plaster.length}
                      onChange={(length) => setPlaster({ ...plaster, length })}
                    />
                    <NumberField
                      label="Wall height"
                      value={plaster.height}
                      onChange={(height) => setPlaster({ ...plaster, height })}
                    />
                  </View>
                  <Text style={styles.label}>Thickness</Text>
                  <ChipGroup
                    options={[12, 20].map((value) => ({ id: value, label: `${value} mm` }))}
                    selected={plasterMm}
                    onSelect={setPlasterMm}
                  />
                  <Text style={styles.label}>Mix (cement : sand)</Text>
                  <ChipGroup
                    options={[4, 6].map((value) => ({ id: value, label: `1 : ${value}` }))}
                    selected={sandParts}
                    onSelect={setSandParts}
                  />
                </>
              ) : (
                <>
                  <View style={styles.fieldRow}>
                    <NumberField label="Length" value={slab.length} onChange={(length) => setSlab({ ...slab, length })} />
                    <NumberField label="Width" value={slab.width} onChange={(width) => setSlab({ ...slab, width })} />
                  </View>
                  <Text style={styles.label}>Thickness</Text>
                  <ChipGroup
                    options={[4, 5, 6].map((value) => ({ id: value, label: `${value} in` }))}
                    selected={slabIn}
                    onSelect={setSlabIn}
                  />
                </>
              )}
            </>
          ) : null}
        </View>

        <View style={styles.result} accessibilityLiveRegion="polite">
          <Text style={styles.resultLabel}>You will need about</Text>
          {result ? (
            <>
              <View style={styles.resultValueRow}>
                <Text style={styles.resultValue}>{result.value}</Text>
                <Text style={styles.resultUnit}>{result.unit}</Text>
              </View>
              {result.lines.map((line) => (
                <Text key={line} style={styles.resultLine}>
                  {line}
                </Text>
              ))}
            </>
          ) : (
            <Text style={styles.resultLine}>Enter sizes above to see an estimate.</Text>
          )}
        </View>

        <Button
          title={active.shopLabel}
          icon="cart-outline"
          onPress={() => router.push({ pathname: '/category/[id]', params: { id: active.categoryId } })}
        />

        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
          <Text style={styles.noteText}>Estimate only. {note}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

type NumberFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  unit?: string;
};

function NumberField({ label, value, onChange, unit = 'ft' }: NumberFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputBox}>
        <TextInput
          value={value}
          onChangeText={(text) => onChange(text.replace(/[^0-9.,]/g, ''))}
          keyboardType="decimal-pad"
          inputMode="decimal"
          accessibilityLabel={`${label} in ${unit === 'ft' ? 'feet' : unit}`}
          placeholder="0"
          placeholderTextColor={colors.placeholder}
          maxLength={6}
          style={styles.input}
        />
        <Text style={styles.unit}>{unit}</Text>
      </View>
    </View>
  );
}

type ChipGroupProps<T extends string | number> = {
  options: { id: T; label: string }[];
  selected: T;
  onSelect: (id: T) => void;
};

function ChipGroup<T extends string | number>({ options, selected, onSelect }: ChipGroupProps<T>) {
  return (
    <View style={styles.chips}>
      {options.map((option) => {
        const isSelected = option.id === selected;
        return (
          <Pressable
            key={String(option.id)}
            onPress={() => onSelect(option.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            style={[styles.chip, isSelected && styles.chipSelected]}
          >
            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screen,
  },
  content: {
    padding: SCREEN_PADDING,
    paddingBottom: spacing.xxl,
  },
  inner: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    gap: spacing.md,
  },
  tabs: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: radius.md,
    backgroundColor: colors.navySoft,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: radius.sm,
  },
  tabSelected: {
    backgroundColor: colors.navy,
  },
  tabText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.semiBold,
    color: colors.navy,
  },
  tabTextSelected: {
    color: colors.white,
  },
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    ...cardShadow,
  },
  cardTitle: {
    fontSize: 15,
    lineHeight: 21,
    fontFamily: fonts.bold,
    color: colors.navy,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  field: {
    flex: 1,
    gap: 4,
  },
  label: {
    marginTop: spacing.xs,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.text,
  },
  unit: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minWidth: 48,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipSelected: {
    borderColor: colors.navy,
    backgroundColor: colors.navy,
  },
  chipText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.medium,
    color: colors.navy,
  },
  chipTextSelected: {
    color: colors.white,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 40,
    marginTop: spacing.xs,
  },
  checkText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.medium,
    color: colors.text,
  },
  result: {
    gap: 2,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.navy,
  },
  resultLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.medium,
    color: colors.textOnDark,
  },
  resultValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    columnGap: spacing.sm,
  },
  resultValue: {
    fontSize: 34,
    lineHeight: 42,
    fontFamily: fonts.bold,
    color: colors.white,
  },
  resultUnit: {
    fontSize: 15,
    lineHeight: 21,
    fontFamily: fonts.semiBold,
    color: colors.white,
  },
  resultLine: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.regular,
    color: colors.textOnDark,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
});
