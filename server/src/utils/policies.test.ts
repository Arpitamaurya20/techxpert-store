import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validatePolicyBody } from './policies.js';

const empty = { intro: [], sections: [] };

describe('validatePolicyBody', () => {
  it('clears a policy when both lists are empty, and refuses a body that leaves them out', () => {
    const page = validatePolicyBody('cancellation', { ...empty, lastUpdated: 'Today', sourceUrl: 'https://example.com' });
    assert.equal(page.lastUpdated, '');
    assert.equal(page.sourceUrl, '');
    assert.deepEqual(page.intro, []);
    assert.deepEqual(page.sections, []);
    assert.throws(() => validatePolicyBody('privacy', {}), /intro must be a list/);
    assert.throws(() => validatePolicyBody('wallet', empty), /shipping/);
  });

  it('keeps a paragraph, a list of points, and the website link', () => {
    const page = validatePolicyBody('privacy', {
      lastUpdated: ' 24 Oct 2026 ',
      sourceUrl: ' https://example.com/privacy ',
      intro: ['  We explain what we keep. ', ''],
      sections: [
        {
          heading: ' What we keep ',
          blocks: [' Names and phone numbers. ', [' Orders ', ''], []],
        },
      ],
    });
    assert.equal(page.title, 'Privacy policy');
    assert.equal(page.lastUpdated, '24 Oct 2026');
    assert.equal(page.sourceUrl, 'https://example.com/privacy');
    assert.deepEqual(page.intro, ['We explain what we keep.']);
    assert.deepEqual(page.sections, [
      { heading: 'What we keep', blocks: ['Names and phone numbers.', ['Orders']] },
    ]);
  });

  it('refuses a section with no heading or no paragraph, and a repeated heading', () => {
    assert.throws(
      () => validatePolicyBody('terms', { ...empty, sections: [{ heading: '', blocks: ['Words.'] }] }),
      /heading/
    );
    assert.throws(
      () => validatePolicyBody('terms', { ...empty, sections: [{ heading: 'Fees', blocks: [] }] }),
      /paragraph/
    );
    assert.throws(
      () =>
        validatePolicyBody('terms', {
          ...empty,
          sections: [
            { heading: 'Fees', blocks: ['One.'] },
            { heading: 'fees', blocks: ['Two.'] },
          ],
        }),
      /only once/
    );
  });

  it('refuses a website link that is not a web address', () => {
    assert.throws(
      () =>
        validatePolicyBody('shipping', {
          ...empty,
          sourceUrl: 'techxpertindia.com',
          intro: ['How orders travel.'],
        }),
      /https:\/\//
    );
  });
});
