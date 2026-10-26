import { badRequest } from './validate.js';

/** One row under the home banners. Four claims fill it. */
export const TRUST_MAX = 4;
export const LABEL_MAX = 32;

/** Names the phone already draws on the trust strip. */
export const TRUST_ICONS = ['truck-fast-outline', 'shield-check-outline', 'tag-outline', 'headset'] as const;
export const TRUST_ACTIONS = ['delivery', 'about', 'help', 'phone'] as const;

export type TrustIcon = (typeof TRUST_ICONS)[number];
export type TrustAction = (typeof TRUST_ACTIONS)[number];
export type TrustClaimInput = { label: string; icon: TrustIcon; action: TrustAction };

function oneLine(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

/**
 * The claims staff can save. A missing list is refused, so an empty body
 * cannot wipe the strip. An empty list clears it.
 */
export function validateTrustClaims(body: unknown): TrustClaimInput[] {
  const source = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  if (!Array.isArray(source.claims)) badRequest('claims must be a list.');
  if (source.claims.length > TRUST_MAX) badRequest('The trust strip holds 4 claims.');

  const cleaned: TrustClaimInput[] = [];
  const seen = new Set<string>();
  for (const raw of source.claims) {
    if (!raw || typeof raw !== 'object') badRequest('Each claim needs words.');
    const item = raw as Record<string, unknown>;
    const label = oneLine(item.label);
    if (!label) badRequest('Each claim needs words.');
    if (label.length > LABEL_MAX) badRequest('Each claim is 32 characters or less.');
    const key = label.toLowerCase();
    if (seen.has(key)) badRequest('Each claim can appear only once.');
    seen.add(key);
    const icon = oneLine(item.icon);
    if (!(TRUST_ICONS as readonly string[]).includes(icon)) {
      badRequest('Choose a delivery van, shield, price tag, or headset.');
    }
    const action = oneLine(item.action);
    if (!(TRUST_ACTIONS as readonly string[]).includes(action)) {
      badRequest('Each claim opens delivery, about, help, or a phone call.');
    }
    cleaned.push({ label, icon: icon as TrustIcon, action: action as TrustAction });
  }
  return cleaned;
}
