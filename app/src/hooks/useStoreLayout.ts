import { useWindowDimensions } from 'react-native';

import { MAX_STORE_WIDTH, SCREEN_PADDING } from '@/constants/theme';

export const GRID_GAP = 12;

function columnWidth(contentWidth: number, columns: number) {
  return Math.floor((contentWidth - GRID_GAP * (columns - 1)) / columns);
}

/** Works out grid columns and card widths from the screen width (phones, tablets and web). */
export function useStoreLayout() {
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_STORE_WIDTH) - SCREEN_PADDING * 2;

  const productColumns = contentWidth >= 900 ? 4 : contentWidth >= 560 ? 3 : 2;
  /** Compact icon cards on Home. */
  const categoryColumns =
    contentWidth >= 900 ? 6 : contentWidth >= 560 ? 5 : contentWidth < 330 ? 3 : 4;
  /** Four-column photo grid on the Categories screen (matches the store layout). */
  const categoryTileColumns = contentWidth >= 900 ? 6 : contentWidth >= 560 ? 5 : 4;

  return {
    contentWidth,
    productColumns,
    categoryColumns,
    categoryTileColumns,
    productCardWidth: columnWidth(contentWidth, productColumns),
    categoryCardWidth: columnWidth(contentWidth, categoryColumns),
    categoryTileWidth: columnWidth(contentWidth, categoryTileColumns),
  };
}
