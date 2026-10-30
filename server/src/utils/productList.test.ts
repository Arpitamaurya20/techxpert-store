import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  cardSearchTerm,
  escapeLike,
  parseProductListOptions,
  trimCardPage,
} from './productList.js';

const refused = (fn: () => unknown, message?: RegExp) =>
  assert.throws(fn, (err: any) => err.statusCode === 400 && (!message || message.test(err.message)));

describe('parseProductListOptions', () => {
  it('defaults to the full row with a total, exactly as before', () => {
    assert.deepEqual(parseProductListOptions({}), { view: 'full', includeTotal: true });
    assert.deepEqual(parseProductListOptions({ page: '3', limit: '50' }), { view: 'full', includeTotal: true });
  });

  it('reads view=card, total=false and after', () => {
    assert.deepEqual(parseProductListOptions({ view: 'card', total: 'false', after: '120' }), {
      view: 'card',
      includeTotal: false,
      after: 120,
    });
  });

  it('accepts total=0 and ignores case', () => {
    assert.equal(parseProductListOptions({ view: 'CARD', total: '0' }).includeTotal, false);
  });

  it('refuses a view it does not know', () => {
    refused(() => parseProductListOptions({ view: 'tiny' }), /view/);
  });

  it('refuses a total that is not true or false', () => {
    refused(() => parseProductListOptions({ total: 'maybe' }), /total/);
  });

  it('refuses after without view=card', () => {
    refused(() => parseProductListOptions({ after: '5' }), /view=card/);
  });

  it('refuses an after that is not a whole number', () => {
    refused(() => parseProductListOptions({ view: 'card', after: 'abc' }), /after/);
    refused(() => parseProductListOptions({ view: 'card', after: '-1' }), /after/);
    refused(() => parseProductListOptions({ view: 'card', after: '1.5' }), /after/);
  });
});

describe('cardSearchTerm', () => {
  it('leaves an absent or blank search alone', () => {
    assert.equal(cardSearchTerm(undefined), undefined);
    assert.equal(cardSearchTerm(''), undefined);
    assert.equal(cardSearchTerm('   '), undefined);
  });

  it('refuses one character with a message the app can show', () => {
    refused(() => cardSearchTerm('a'), /at least 2 characters/);
    refused(() => cardSearchTerm('  a '), /at least 2 characters/);
  });

  it('trims and accepts two or more', () => {
    assert.equal(cardSearchTerm('  fan '), 'fan');
    assert.equal(cardSearchTerm('ac'), 'ac');
  });
});

describe('escapeLike', () => {
  it('makes wildcards literal', () => {
    assert.equal(escapeLike('50%'), '50\\%');
    assert.equal(escapeLike('a_b'), 'a\\_b');
    assert.equal(escapeLike('a\\b'), 'a\\\\b');
    assert.equal(escapeLike('fan'), 'fan');
  });
});

describe('trimCardPage', () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1 }));

  it('reports another page when the extra row arrived', () => {
    const out = trimCardPage(rows(4), 3);
    assert.equal(out.rows.length, 3);
    assert.equal(out.hasMore, true);
    assert.equal(out.nextAfter, 3);
  });

  it('reports the end when there is no extra row', () => {
    const out = trimCardPage(rows(3), 3);
    assert.equal(out.rows.length, 3);
    assert.equal(out.hasMore, false);
    assert.equal(out.nextAfter, null);
  });

  it('handles an empty page', () => {
    const out = trimCardPage([], 3);
    assert.deepEqual(out, { rows: [], hasMore: false, nextAfter: null });
  });
});
