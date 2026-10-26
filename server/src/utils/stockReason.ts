export const STOCK_REASONS = ['received', 'counted', 'damaged'] as const;
export type StockReason = (typeof STOCK_REASONS)[number];

const LABELS: Record<StockReason, string> = {
  received: 'Received',
  counted: 'Counted',
  damaged: 'Damaged',
};

/** Empty means no reason was given. Anything else must be one of the three. */
export function readStockReason(raw: unknown): StockReason | null {
  if (raw == null || raw === '') return null;
  if (raw === 'received' || raw === 'counted' || raw === 'damaged') return raw;
  throw Object.assign(new Error('Say whether the stock was received, counted, or damaged.'), { statusCode: 400 });
}

export function stockReasonLabel(reason: StockReason): string {
  return LABELS[reason];
}

export type StockFigure = { label: string; before: number | null; after: number | null };

/** Only the quantities that would change. A missing store row is null, which means that store sells the company figure. */
export function changedStock(rows: StockFigure[]): StockFigure[] {
  return rows.filter((row) => row.before !== row.after);
}

export function stockChangeRefusal(changes: StockFigure[], reason: StockReason | null): string | null {
  if (!changes.length) return null;
  if (!reason) return 'Say why the stock changed: received, counted, or damaged.';
  return null;
}

export function stockChangeDetails(productName: string, reason: StockReason, changes: StockFigure[]): string {
  const lines = changes.map((row) => {
    if (row.before == null) return `${row.label} set to ${row.after}`;
    if (row.after == null) return `${row.label} cleared`;
    return `${row.label} ${row.before} to ${row.after}`;
  });
  return `${productName}: ${stockReasonLabel(reason)}. ${lines.join('. ')}.`;
}
