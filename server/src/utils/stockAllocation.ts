/** Spread a catalogue total across existing inventory rows without going negative on the earlier rows. */
export function allocateCatalogueStock(
  rows: { id: number; quantity: number }[],
  target: number,
): { id: number; quantity: number }[] {
  const total = Math.max(0, Math.round(Number(target) || 0));
  if (rows.length === 0) return [];
  let remaining = total;
  return rows.map((row, index) => {
    if (index === rows.length - 1) {
      return { id: row.id, quantity: remaining };
    }
    const keep = Math.min(Math.max(0, Number(row.quantity) || 0), remaining);
    remaining -= keep;
    return { id: row.id, quantity: keep };
  });
}
