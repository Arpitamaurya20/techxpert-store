import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  STAFF_TOKEN_AUDIENCE,
  cleanStaffName,
  issuedBeforePasswordChange,
  normalizeEmail,
  passwordProblem,
  staffIdFromClaims,
  temporaryPassword,
} from './staffAccounts.js';

describe('normalizeEmail', () => {
  it('trims and lower-cases a valid email', () => {
    assert.equal(normalizeEmail('  Ravi.K@Techxpert.IN '), 'ravi.k@techxpert.in');
  });

  it('refuses blanks and malformed addresses', () => {
    assert.equal(normalizeEmail(''), null);
    assert.equal(normalizeEmail('ravi'), null);
    assert.equal(normalizeEmail('ravi@techxpert'), null);
    assert.equal(normalizeEmail('ra vi@techxpert.in'), null);
    assert.equal(normalizeEmail(undefined), null);
  });
});

describe('cleanStaffName', () => {
  it('collapses spaces and keeps 2 to 120 characters', () => {
    assert.equal(cleanStaffName('  Ravi   Kumar '), 'Ravi Kumar');
    assert.equal(cleanStaffName('R'), null);
    assert.equal(cleanStaffName('x'.repeat(121)), null);
  });
});

describe('passwordProblem', () => {
  it('needs at least 10 characters', () => {
    assert.match(passwordProblem('short') ?? '', /at least 10/);
    assert.equal(passwordProblem('long enough pass'), null);
  });

  it('refuses the email, only spaces, and the current password', () => {
    assert.ok(passwordProblem('ravi@techxpert.in', { email: 'ravi@techxpert.in' }));
    assert.ok(passwordProblem(' '.repeat(12)));
    assert.ok(passwordProblem('same password 1', { current: 'same password 1' }));
  });
});

describe('temporaryPassword', () => {
  it('is 12 characters with no look-alike characters', () => {
    for (let i = 0; i < 200; i += 1) {
      const pw = temporaryPassword();
      assert.equal(pw.length, 12);
      assert.doesNotMatch(pw, /[0Oo1lI]/);
    }
  });

  it('does not repeat', () => {
    const seen = new Set(Array.from({ length: 500 }, () => temporaryPassword()));
    assert.equal(seen.size, 500);
  });
});

describe('issuedBeforePasswordChange', () => {
  const changed = new Date('2026-10-23T08:00:00Z');
  const second = changed.getTime() / 1000;

  it('keeps every token when the password never changed', () => {
    assert.equal(issuedBeforePasswordChange(0, null), false);
  });

  it('refuses tokens from before the change', () => {
    assert.equal(issuedBeforePasswordChange(second - 1, changed), true);
  });

  it('keeps tokens from the same second or later', () => {
    assert.equal(issuedBeforePasswordChange(second, changed), false);
    assert.equal(issuedBeforePasswordChange(second + 60, changed), false);
  });

  it('refuses a token without iat once a change is recorded', () => {
    assert.equal(issuedBeforePasswordChange(undefined, changed), true);
  });
});

describe('staffIdFromClaims', () => {
  it('reads staffId from a portal staff token', () => {
    assert.equal(staffIdFromClaims({ staffId: 1001, aud: STAFF_TOKEN_AUDIENCE }), 1001);
    assert.equal(staffIdFromClaims({ staffId: 1001, aud: ['other', STAFF_TOKEN_AUDIENCE] }), 1001);
  });

  it('refuses old adminId tokens, Homecare tokens and customer tokens', () => {
    assert.equal(staffIdFromClaims({ adminId: 4, role: 'admin' }), null);
    assert.equal(staffIdFromClaims({ staffId: 1001 }), null);
    assert.equal(staffIdFromClaims({ staffId: 1001, aud: 'homecare' }), null);
    assert.equal(staffIdFromClaims({ userId: 12 }), null);
    assert.equal(staffIdFromClaims({ staffId: 'x', aud: STAFF_TOKEN_AUDIENCE }), null);
    assert.equal(staffIdFromClaims(null), null);
  });
});
