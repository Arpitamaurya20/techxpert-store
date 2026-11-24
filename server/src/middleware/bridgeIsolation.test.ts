import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { BRIDGE_AUD_S2S, BRIDGE_ISS, verifyBridgeToken } from '../config/bridgeAuth.js';
import { getJwtSecret } from '../config/security.js';

const BRIDGE = 'test-homecare-store-bridge-secret-32chars';
const originalBridge = process.env.HOMECARE_STORE_BRIDGE_SECRET;
const originalJwt = process.env.JWT_SECRET;

afterEach(() => {
  if (originalBridge === undefined) delete process.env.HOMECARE_STORE_BRIDGE_SECRET;
  else process.env.HOMECARE_STORE_BRIDGE_SECRET = originalBridge;
  if (originalJwt === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwt;
});

describe('bridge token isolation from customer JWT', () => {
  it('does not verify a server-to-server bridge token with the Store JWT secret', () => {
    process.env.HOMECARE_STORE_BRIDGE_SECRET = BRIDGE;
    process.env.JWT_SECRET = 'store-customer-jwt-secret-value-xx';
    const token = jwt.sign(
      { iss: BRIDGE_ISS, sub: '7', aud: BRIDGE_AUD_S2S, scope: 'orders:read' },
      BRIDGE,
      { algorithm: 'HS256', expiresIn: 60 }
    );

    assert.throws(() => jwt.verify(token, getJwtSecret()));
    const claims = verifyBridgeToken(token, {
      audience: BRIDGE_AUD_S2S,
      requiredScopes: ['orders:read'],
    });
    assert.equal(claims.sub, 7);
  });
});
