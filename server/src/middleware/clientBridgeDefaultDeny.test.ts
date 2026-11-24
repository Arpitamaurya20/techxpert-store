import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { BRIDGE_AUD_CLIENT, BRIDGE_ISS } from '../config/bridgeAuth.js';
import { extractAuth } from './auth.js';
import type { Request } from 'express';

const SECRET = 'test-homecare-store-bridge-secret-32chars';

describe('client bridge default-deny', () => {
  it('attaches req.bridge but does not set userId until allowClientBridge', () => {
    process.env.HOMECARE_STORE_BRIDGE_SECRET = SECRET;
    process.env.ALLOW_HOMECARE_EXCHANGE_TOKENS = 'true';
    process.env.JWT_SECRET = 'store-customer-jwt-secret-value-xx';

    const token = jwt.sign(
      {
        iss: BRIDGE_ISS,
        sub: '55',
        aud: BRIDGE_AUD_CLIENT,
        scope: 'catalog cart checkout orders delivery',
        channel: 'homecare_app',
      },
      SECRET,
      { algorithm: 'HS256', expiresIn: 900 }
    );

    const req = {
      headers: { authorization: `Bearer ${token}` },
      path: '/wishlist',
      method: 'GET',
    } as unknown as Request;

    const claims = extractAuth(req);
    assert.equal(claims, null);
    assert.equal(req.bridge?.sub, 55);
    assert.equal(req.user?.userId, undefined);
  });
});
