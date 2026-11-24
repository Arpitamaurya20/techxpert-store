import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import {
  BRIDGE_AUD_CLIENT,
  BRIDGE_AUD_S2S,
  BRIDGE_ISS,
  verifyBridgeToken,
} from './bridgeAuth.js';

const SECRET = 'test-homecare-store-bridge-secret-32chars';
const OTHER = 'other-secret-not-the-bridge-secret!!';

const originalSecret = process.env.HOMECARE_STORE_BRIDGE_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.HOMECARE_STORE_BRIDGE_SECRET;
  else process.env.HOMECARE_STORE_BRIDGE_SECRET = originalSecret;
});

function mint(claims: Record<string, unknown>, secret = SECRET, opts: jwt.SignOptions = {}) {
  process.env.HOMECARE_STORE_BRIDGE_SECRET = SECRET;
  return jwt.sign(claims, secret, { algorithm: 'HS256', ...opts });
}

describe('verifyBridgeToken', () => {
  it('accepts a valid server-to-server token', () => {
    process.env.HOMECARE_STORE_BRIDGE_SECRET = SECRET;
    const token = mint({
      iss: BRIDGE_ISS,
      sub: '42',
      aud: BRIDGE_AUD_S2S,
      scope: 'orders:read',
    }, SECRET, { expiresIn: 60 });

    const claims = verifyBridgeToken(token, {
      audience: BRIDGE_AUD_S2S,
      requiredScopes: ['orders:read'],
    });
    assert.equal(claims.sub, 42);
    assert.equal(claims.aud, BRIDGE_AUD_S2S);
    assert.deepEqual(claims.scopes, ['orders:read']);
  });

  it('rejects a wrong signature', () => {
    process.env.HOMECARE_STORE_BRIDGE_SECRET = SECRET;
    const token = mint(
      { iss: BRIDGE_ISS, sub: '1', aud: BRIDGE_AUD_S2S, scope: 'orders:read' },
      OTHER,
      { expiresIn: 60 }
    );
    assert.throws(
      () => verifyBridgeToken(token, { audience: BRIDGE_AUD_S2S, requiredScopes: ['orders:read'] }),
      (err: any) => err?.statusCode === 401
    );
  });

  it('rejects a wrong issuer', () => {
    process.env.HOMECARE_STORE_BRIDGE_SECRET = SECRET;
    const token = mint(
      { iss: 'other', sub: '1', aud: BRIDGE_AUD_S2S, scope: 'orders:read' },
      SECRET,
      { expiresIn: 60 }
    );
    assert.throws(
      () => verifyBridgeToken(token, { audience: BRIDGE_AUD_S2S, requiredScopes: ['orders:read'] }),
      (err: any) => err?.statusCode === 401
    );
  });

  it('rejects a wrong audience', () => {
    process.env.HOMECARE_STORE_BRIDGE_SECRET = SECRET;
    const token = mint(
      { iss: BRIDGE_ISS, sub: '1', aud: BRIDGE_AUD_CLIENT, scope: 'orders:read', channel: 'homecare_app' },
      SECRET,
      { expiresIn: 60 }
    );
    assert.throws(
      () => verifyBridgeToken(token, { audience: BRIDGE_AUD_S2S, requiredScopes: ['orders:read'] }),
      (err: any) => err?.statusCode === 401
    );
  });

  it('rejects an expired token', () => {
    process.env.HOMECARE_STORE_BRIDGE_SECRET = SECRET;
    const token = mint(
      { iss: BRIDGE_ISS, sub: '1', aud: BRIDGE_AUD_S2S, scope: 'orders:read' },
      SECRET,
      { expiresIn: -10 }
    );
    assert.throws(
      () => verifyBridgeToken(token, { audience: BRIDGE_AUD_S2S, requiredScopes: ['orders:read'] }),
      (err: any) => err?.statusCode === 401
    );
  });

  it('rejects a missing scope with 403', () => {
    process.env.HOMECARE_STORE_BRIDGE_SECRET = SECRET;
    const token = mint(
      { iss: BRIDGE_ISS, sub: '1', aud: BRIDGE_AUD_S2S, scope: 'catalog' },
      SECRET,
      { expiresIn: 60 }
    );
    assert.throws(
      () => verifyBridgeToken(token, { audience: BRIDGE_AUD_S2S, requiredScopes: ['orders:read'] }),
      (err: any) => err?.statusCode === 403
    );
  });

  it('rejects a non-integer sub', () => {
    process.env.HOMECARE_STORE_BRIDGE_SECRET = SECRET;
    const token = mint(
      { iss: BRIDGE_ISS, sub: 'abc', aud: BRIDGE_AUD_S2S, scope: 'orders:read' },
      SECRET,
      { expiresIn: 60 }
    );
    assert.throws(
      () => verifyBridgeToken(token, { audience: BRIDGE_AUD_S2S, requiredScopes: ['orders:read'] }),
      (err: any) => err?.statusCode === 401
    );
  });

  it('rejects when the bridge secret is unset', () => {
    const token = mint(
      { iss: BRIDGE_ISS, sub: '1', aud: BRIDGE_AUD_S2S, scope: 'orders:read' },
      SECRET,
      { expiresIn: 60 }
    );
    delete process.env.HOMECARE_STORE_BRIDGE_SECRET;
    assert.throws(
      () => verifyBridgeToken(token, { audience: BRIDGE_AUD_S2S, requiredScopes: ['orders:read'] }),
      (err: any) => err?.statusCode === 503
    );
  });
});
