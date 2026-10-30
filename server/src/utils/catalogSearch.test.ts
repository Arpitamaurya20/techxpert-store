import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  bigramScore,
  expandSearchTerms,
  fulltextBooleanQuery,
  searchWords,
  typoSuggestions,
} from './catalogSearch.js';

describe('expandSearchTerms', () => {
  it('includes the query and known synonyms', () => {
    const terms = expandSearchTerms('fan');
    assert.ok(terms.includes('fan'));
    assert.ok(terms.includes('ceiling fan'));
  });

  it('is case-insensitive', () => {
    assert.ok(expandSearchTerms('MCB').includes('breaker'));
  });
});

describe('searchWords', () => {
  it('keeps tokens of length 2+', () => {
    assert.deepEqual(searchWords('LED bulb'), ['led', 'bulb']);
    assert.deepEqual(searchWords('a fan'), ['fan']);
  });
});

describe('bigramScore / typoSuggestions', () => {
  it('scores similar names higher', () => {
    assert.ok(bigramScore('havells', 'havels') > bigramScore('havells', 'siemens'));
  });

  it('returns close category names', () => {
    const out = typoSuggestions('lightng', [
      { id: 1, name: 'Lighting' },
      { id: 2, name: 'Plumbing' },
    ]);
    assert.equal(out[0]?.name, 'Lighting');
  });
});

describe('fulltextBooleanQuery', () => {
  it('returns null for short tokens only', () => {
    assert.equal(fulltextBooleanQuery('ac'), null);
    assert.equal(fulltextBooleanQuery('a b'), null);
  });

  it('builds prefix terms for longer words', () => {
    const q = fulltextBooleanQuery('ceiling fan');
    assert.ok(q);
    assert.match(q!, /\+ceiling\*/);
    assert.match(q!, /\+fan\*/);
  });
});
