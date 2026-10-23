/**
 * What the phone is allowed to see.
 * Draft, paused, and archived never qualify.
 * Published is live unless now is outside startsAt/endsAt.
 * Scheduled is live only inside that window, and needs a start.
 */
export function isBannerLiveForCustomers(
  banner: { status?: string | null; startsAt?: string | Date | null; endsAt?: string | Date | null },
  now: Date = new Date(),
): boolean {
  const status = String(banner.status || '').toLowerCase();
  if (status !== 'published' && status !== 'scheduled') return false;

  const nowMs = now.getTime();
  const start = parseInstant(banner.startsAt);
  const end = parseInstant(banner.endsAt);

  if (status === 'scheduled' && start == null) return false;
  if (start != null && nowMs < start) return false;
  if (end != null && nowMs > end) return false;
  return true;
}

function parseInstant(value: string | Date | null | undefined): number | null {
  if (value == null || value === '') return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}
