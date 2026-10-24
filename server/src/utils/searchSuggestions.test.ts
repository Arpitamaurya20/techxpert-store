import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PHRASE_MAX, SUGGESTION_MAX, validateSearchSuggestions } from './searchSuggestions.js';

describe('validateSearchSuggestions', () => {
  it('refuses a body that leaves the list out, and accepts an empty list', () => {
    assert.throws(() => validateSearchSuggestions({}), /must be a list/);
    assert.throws(() => validateSearchSuggestions(null), /must be a list/);
    assert.deepEqual(validateSearchSuggestions({ suggestions: [] }), []);
  });

  it('trims, collapses spaces, drops blanks and keeps order', () => {
    assert.deepEqual(
      validateSearchSuggestions({ suggestions: [' LED bulbs ', '', '  PVC   pipes', 'Cement'] }),
      ['LED bulbs', 'PVC pipes', 'Cement']
    );
  });

  it('refuses a repeated idea, ignoring capital letters', () => {
    assert.throws(
      () => validateSearchSuggestions({ suggestions: ['LED bulbs', 'led bulbs'] }),
      /only once/
    );
  });

  it('refuses a non-list, a non-word, a long idea, and more than eight', () => {
    assert.throws(() => validateSearchSuggestions({ suggestions: 'Cement' }), /must be a list/);
    assert.throws(() => validateSearchSuggestions({ suggestions: [1] }), /must be words/);
    assert.throws(
      () => validateSearchSuggestions({ suggestions: ['a'.repeat(PHRASE_MAX + 1)] }),
      /40 characters/
    );
    const suggestions = Array.from({ length: SUGGESTION_MAX + 1 }, (_, index) => `Idea ${index + 1}`);
    assert.throws(() => validateSearchSuggestions({ suggestions }), /up to 8/);
  });
});
