import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isBannerLiveForCustomers } from './bannerEligibility.js';
import { validateBannerBody } from './validate.js';

const now = new Date('2026-10-23T04:00:00.000Z');

describe('isBannerLiveForCustomers', () => {
  it('hides paused, draft, and archived', () => {
    for (const status of ['paused', 'draft', 'archived'] as const) {
      assert.equal(
        isBannerLiveForCustomers({ status, startsAt: '2026-10-01T00:00:00.000Z' }, now),
        false,
      );
    }
  });

  it('shows a published banner with no window', () => {
    assert.equal(isBannerLiveForCustomers({ status: 'published' }, now), true);
  });

  it('hides a published banner before it starts or after it ends', () => {
    assert.equal(
      isBannerLiveForCustomers({ status: 'published', startsAt: '2026-10-24T00:00:00.000Z' }, now),
      false,
    );
    assert.equal(
      isBannerLiveForCustomers({ status: 'published', endsAt: '2026-10-22T00:00:00.000Z' }, now),
      false,
    );
  });

  it('shows a scheduled banner only inside its window', () => {
    assert.equal(isBannerLiveForCustomers({ status: 'scheduled' }, now), false);
    assert.equal(
      isBannerLiveForCustomers(
        {
          status: 'scheduled',
          startsAt: '2026-10-23T03:00:00.000Z',
          endsAt: '2026-10-23T05:00:00.000Z',
        },
        now,
      ),
      true,
    );
  });
});

describe('validateBannerBody', () => {
  const base = { title: 'Diwali', imageUrl: 'https://cdn.example.com/hero.jpg' };

  it('accepts paused', () => {
    const body = validateBannerBody({ ...base, status: 'paused' });
    assert.equal(body.status, 'paused');
  });

  it('rejects an unknown status', () => {
    assert.throws(() => validateBannerBody({ ...base, status: 'live' }), /status must be one of/);
  });

  it('rejects an end before the start', () => {
    assert.throws(
      () =>
        validateBannerBody({
          ...base,
          startsAt: '2026-10-24T00:00:00.000Z',
          endsAt: '2026-10-23T00:00:00.000Z',
        }),
      /endsAt must be on or after startsAt/,
    );
  });

  it('does not clear the other date on a one-sided update', () => {
    const body = validateBannerBody({ startsAt: '2026-10-23T03:00:00.000Z' }, true);
    assert.equal(body.startsAt, '2026-10-23T03:00:00.000Z');
    assert.equal('endsAt' in body, false);
  });
});
