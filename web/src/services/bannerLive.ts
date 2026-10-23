/**
 * Same rule as the server's `isBannerLiveForCustomers` (server/src/utils/bannerEligibility.ts):
 * published is live unless now is outside its dates; scheduled is live only inside them and needs a start.
 */
export function isBannerLive(
  banner: { status?: string | null; startsAt?: string | null; endsAt?: string | null },
  now: Date = new Date(),
): boolean {
  const status = String(banner.status || '').toLowerCase();
  if (status !== 'published' && status !== 'scheduled') return false;
  const start = instant(banner.startsAt);
  const end = instant(banner.endsAt);
  if (status === 'scheduled' && start == null) return false;
  if (start != null && now.getTime() < start) return false;
  if (end != null && now.getTime() > end) return false;
  return true;
}

function instant(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}
