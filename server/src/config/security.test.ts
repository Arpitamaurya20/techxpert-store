import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEV_OTP, isDevCustomerLoginAllowed } from './security.js';

const original = process.env.NODE_ENV;
afterEach(() => {
  if (original === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = original;
});

describe('isDevCustomerLoginAllowed', () => {
  it('is on locally', () => {
    delete process.env.NODE_ENV;
    assert.equal(isDevCustomerLoginAllowed(), true);
    process.env.NODE_ENV = 'development';
    assert.equal(isDevCustomerLoginAllowed(), true);
  });

  it('is always off in production', () => {
    process.env.NODE_ENV = 'production';
    assert.equal(isDevCustomerLoginAllowed(), false);
  });

  it('uses the documented local code', () => {
    assert.equal(DEV_OTP, '123456');
  });
});
