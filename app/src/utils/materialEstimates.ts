/**
 * Rough material estimates using common Indian site rules of thumb.
 * Inputs are in feet (what customers measure in); results are rounded up.
 * These are guides only — actual needs depend on the product and the site.
 */

export type CalculatorMode = 'paint' | 'tiles' | 'cement';

const SQ_FT_PER_SQ_M = 10.7639;
const CU_FT_PER_CU_M = 35.3147;
const CEMENT_KG_PER_CU_M = 1440;
const CEMENT_BAG_KG = 50;

/** Typical emulsion spread per coat; packs usually state 90–140 sq ft per litre. */
export const PAINT_COVERAGE_SQ_FT_PER_LITRE = 100;
export const TILE_WASTAGE = 0.1;

export type PaintInput = { length: number; width: number; height: number; coats: number; ceiling: boolean };
export type PaintEstimate = { areaSqFt: number; litres: number };

export function estimatePaint({ length, width, height, coats, ceiling }: PaintInput): PaintEstimate | null {
  if (length <= 0 || width <= 0 || height <= 0 || coats <= 0) return null;
  const areaSqFt = 2 * (length + width) * height + (ceiling ? length * width : 0);
  const litres = Math.ceil(((areaSqFt * coats) / PAINT_COVERAGE_SQ_FT_PER_LITRE) * 2) / 2;
  return { areaSqFt: Math.round(areaSqFt), litres };
}

export type TileSize = { id: string; label: string; widthMm: number; lengthMm: number };

export const TILE_SIZES: TileSize[] = [
  { id: '300x300', label: '300×300 mm', widthMm: 300, lengthMm: 300 },
  { id: '600x600', label: '600×600 mm', widthMm: 600, lengthMm: 600 },
  { id: '800x800', label: '800×800 mm', widthMm: 800, lengthMm: 800 },
  { id: '600x1200', label: '600×1200 mm', widthMm: 600, lengthMm: 1200 },
];

export type TilesInput = { length: number; width: number; tile: TileSize; tilesPerBox?: number };
export type TilesEstimate = { areaSqFt: number; tiles: number; boxes?: number };

export function estimateTiles({ length, width, tile, tilesPerBox }: TilesInput): TilesEstimate | null {
  if (length <= 0 || width <= 0) return null;
  const areaSqFt = length * width;
  const tileSqFt = ((tile.widthMm / 1000) * (tile.lengthMm / 1000)) * SQ_FT_PER_SQ_M;
  const tiles = Math.ceil((areaSqFt * (1 + TILE_WASTAGE)) / tileSqFt);
  return {
    areaSqFt: Math.round(areaSqFt),
    tiles,
    boxes: tilesPerBox && tilesPerBox > 0 ? Math.ceil(tiles / tilesPerBox) : undefined,
  };
}

export type CementWork = 'plaster' | 'concrete';

/** Plaster: wall length × height, with a 1 : `sandParts` cement–sand mix. */
export type PlasterInput = { length: number; height: number; thicknessMm: number; sandParts: number };
/** Concrete: M20 (1 : 1.5 : 3) slab or floor, thickness in inches. */
export type ConcreteInput = { length: number; width: number; thicknessIn: number };

export type CementEstimate = {
  bags: number;
  sandCuFt: number;
  aggregateCuFt?: number;
  areaOrVolume: string;
};

export function estimatePlaster({ length, height, thicknessMm, sandParts }: PlasterInput): CementEstimate | null {
  if (length <= 0 || height <= 0 || thicknessMm <= 0) return null;
  const areaSqFt = length * height;
  const wetCuM = (areaSqFt / SQ_FT_PER_SQ_M) * (thicknessMm / 1000);
  // +20% for uneven surfaces and joints, then ×1.27 for dry volume of the mix.
  const dryCuM = wetCuM * 1.2 * 1.27;
  const parts = 1 + sandParts;
  return {
    bags: Math.ceil(((dryCuM / parts) * CEMENT_KG_PER_CU_M) / CEMENT_BAG_KG),
    sandCuFt: Math.ceil(((dryCuM * sandParts) / parts) * CU_FT_PER_CU_M),
    areaOrVolume: `${Math.round(areaSqFt)} sq ft of wall`,
  };
}

export function estimateConcrete({ length, width, thicknessIn }: ConcreteInput): CementEstimate | null {
  if (length <= 0 || width <= 0 || thicknessIn <= 0) return null;
  const wetCuFt = length * width * (thicknessIn / 12);
  // ×1.54 for dry volume of an M20 (1 : 1.5 : 3) mix.
  const dryCuM = (wetCuFt / CU_FT_PER_CU_M) * 1.54;
  const parts = 1 + 1.5 + 3;
  return {
    bags: Math.ceil(((dryCuM / parts) * CEMENT_KG_PER_CU_M) / CEMENT_BAG_KG),
    sandCuFt: Math.ceil(((dryCuM * 1.5) / parts) * CU_FT_PER_CU_M),
    aggregateCuFt: Math.ceil(((dryCuM * 3) / parts) * CU_FT_PER_CU_M),
    areaOrVolume: `${Math.round(wetCuFt)} cu ft of concrete`,
  };
}
