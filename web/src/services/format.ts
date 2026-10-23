/** True for anything that can be shown as an amount; null/undefined/NaN mean "not recorded". */
export const isMoney = (value: unknown): value is number =>
  value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));

/** ₹ with Indian grouping: ₹1,23,456.50. Pass `whole` for summary figures: ₹1,23,457. */
export const inr = (value: number, whole = false) =>
  `₹${Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  })}`;

const toDate = (value: string | number | Date) => (value instanceof Date ? value : new Date(value));

/** "23 Oct, 12:40"; the year is added only when it isn't this year: "23 Oct 2025, 12:40". */
export const formatWhen = (value: string | number | Date | null | undefined): string | null => {
  if (value === null || value === undefined || value === '') return null;
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return null;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const day = d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${day}, ${time}`;
};

/** "23 Oct 2026" for dates without a time. */
export const formatDay = (value: string | number | Date | null | undefined): string | null => {
  if (value === null || value === undefined || value === '') return null;
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
