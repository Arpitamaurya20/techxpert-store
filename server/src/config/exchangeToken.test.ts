import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import {
  BRIDGE_AUD_CLIENT,
  BRIDGE_ISS,
  exchangeTokensAllowed,
  verifyBridgeToken,
} from './bridgeAuth.js';

const SECRET = 'test-homecare-store-bridge-secret-32chars';
const originalSecret = process.env.HOMECARE_STORE_BRIDGE_SECRET;
const originalAllow = process.env.ALLOW_HOMECARE_EXCHANGE_TOKENS;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.HOMECARE_STORE_BRIDGE_SECRET;
  else process.env.HOMECARE_STORE_BRIDGE_SECRET = originalSecret;
  if (originalAllow === undefined) delete process.env.ALLOW_HOMECARE_EXCHANGE_TOKENS;
  else process.env.ALLOW_HOMECARE_EXCHANGE_TOKENS = originalAllow;
});

describe('exchange token flag and client claims', () => {
  it('defaults exchange tokens to off', () => {
    delete process.env.ALLOW_HOMECARE_EXCHANGE_TOKENS;
    assert.equal(exchangeTokensAllowed(), false);
  });

  it('turns on when ALLOW_HOMECARE_EXCHANGE_TOKENS=true', () => {
    process.env.ALLOW_HOMECARE_EXCHANGE_TOKENS = 'true';
    assert.equal(exchangeTokensAllowed(), true);
  });

  it('requires channel homecare_app on client audience tokens', () => {
    process.env.HOMECARE_STORE_BRIDGE_SECRET = SECRET;
    const token = jwt.sign(
      {
        iss: BRIDGE_ISS,
        sub: '9',
        aud: BRIDGE_AUD_CLIENT,
        scope: 'catalog cart checkout orders delivery',
      },
      SECRET,
      { algorithm: 'HS256', expiresIn: 900 }
    );
    assert.throws(
      () =>
        verifyBridgeToken(token, {
          audience: BRIDGE_AUD_CLIENT,
          requiredScopes: ['cart'],
        }),
      (err: any) => err?.statusCode === 401
    );
  });

  it('accepts a client token with channel and scopes', () => {
    process.env.HOMECARE_STORE_BRIDGE_SECRET = SECRET;
    const token = jwt.sign(
      {
        iss: BRIDGE_ISS,
        sub: '9',
        aud: BRIDGE_AUD_CLIENT,
        scope: 'catalog delivery cart checkout orders',
        channel: 'homecare_app',
      },
      SECRET,
      { algorithm: 'HS256', expiresIn: 900 }
    );
    const claims = verifyBridgeToken(token, {
      audience: BRIDGE_AUD_CLIENT,
      requiredScopes: ['checkout'],
    });
    assert.equal(claims.sub, 9);
    assert.equal(claims.channel, 'homecare_app');
  });
});
