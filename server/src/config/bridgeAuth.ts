import jwt from 'jsonwebtoken';

/** Homecare → Store bridge issuer (contract). */
export const BRIDGE_ISS = 'homecare';
/** Server-to-server Activity / order reads. */
export const BRIDGE_AUD_S2S = 'techxpert-store-s2s';
/** Homecare app Mode B client exchange. */
export const BRIDGE_AUD_CLIENT = 'techxpert-store-client';

export const CONTRACT_VERSION = '1';

export type BridgeAudience = typeof BRIDGE_AUD_S2S | typeof BRIDGE_AUD_CLIENT;

export type BridgeClaims = {
  iss: typeof BRIDGE_ISS;
  sub: number;
  aud: BridgeAudience;
  scopes: string[];
  exp: number;
  channel?: 'homecare_app';
};

function refusal(statusCode: number, message: string) {
  return Object.assign(new Error(message), { statusCode });
}

/** Dedicated bridge secret — never the Store or Homecare master JWT_SECRET. */
export function getBridgeSecret(): string {
  const secret = process.env.HOMECARE_STORE_BRIDGE_SECRET?.trim();
  if (!secret || secret.length < 24) {
    throw refusal(503, 'Store bridge auth is not configured.');
  }
  return secret;
}

export function exchangeTokensAllowed(): boolean {
  return String(process.env.ALLOW_HOMECARE_EXCHANGE_TOKENS || '')
    .trim()
    .toLowerCase() === 'true';
}

function parseScopes(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((s) => String(s).trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function parseSub(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isInteger(raw) && raw > 0) return raw;
  if (typeof raw === 'string' && /^\d+$/.test(raw)) {
    const n = Number(raw);
    if (Number.isInteger(n) && n > 0) return n;
  }
  return null;
}

/**
 * Verifies a Homecare-minted bridge JWT for the expected audience and scopes.
 * Does not check that the customer exists — middleware does that.
 */
export function verifyBridgeToken(
  token: string,
  options: { audience: BridgeAudience; requiredScopes: string[] }
): BridgeClaims {
  let secret: string;
  try {
    secret = getBridgeSecret();
  } catch (err) {
    throw err;
  }

  let raw: jwt.JwtPayload;
  try {
    raw = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      audience: options.audience,
      issuer: BRIDGE_ISS,
    }) as jwt.JwtPayload;
  } catch {
    throw refusal(401, 'Invalid or expired bridge token.');
  }

  const sub = parseSub(raw.sub);
  if (sub == null) {
    throw refusal(401, 'Invalid bridge token subject.');
  }

  const aud = raw.aud;
  const audValue = Array.isArray(aud) ? aud[0] : aud;
  if (audValue !== options.audience) {
    throw refusal(401, 'Invalid bridge token audience.');
  }

  const scopes = parseScopes(raw.scope);
  for (const need of options.requiredScopes) {
    if (!scopes.includes(need)) {
      throw refusal(403, 'Bridge token is missing required scope.');
    }
  }

  const channel =
    raw.channel === 'homecare_app' ? ('homecare_app' as const) : undefined;

  if (options.audience === BRIDGE_AUD_CLIENT && channel !== 'homecare_app') {
    throw refusal(401, 'Client bridge token must carry channel homecare_app.');
  }

  return {
    iss: BRIDGE_ISS,
    sub,
    aud: options.audience,
    scopes,
    exp: typeof raw.exp === 'number' ? raw.exp : 0,
    ...(channel ? { channel } : {}),
  };
}
