import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FACT_MAX, validateAboutBody, VALUE_MAX } from './aboutPage.js';

describe('validateAboutBody', () => {
  it('accepts an empty page', () => {
    assert.deepEqual(validateAboutBody({}), {
      missionTitle: '',
      missionBody: '',
      facts: [],
      values: [],
    });
    assert.deepEqual(validateAboutBody(null).facts, []);
  });

  it('trims the mission and keeps a fact and a value', () => {
    const page = validateAboutBody({
      missionTitle: '  Our mission ',
      missionBody: '  Make life   easier. ',
      facts: [{ value: ' 2017 ', label: ' Founded ' }, { value: '', label: '' }],
      values: [{ icon: 'ribbon-outline', title: ' Excellence ', body: ' High standards. ' }],
    });
    assert.equal(page.missionTitle, 'Our mission');
    assert.equal(page.missionBody, 'Make life easier.');
    assert.deepEqual(page.facts, [{ value: '2017', label: 'Founded' }]);
    assert.equal(page.values[0].title, 'Excellence');
    assert.equal(page.values[0].icon, 'ribbon-outline');
  });

  it('refuses a half-filled fact or value, and a repeated name', () => {
    assert.throws(() => validateAboutBody({ facts: [{ value: '2017', label: '' }] }), /figure and a name/);
    assert.throws(() => validateAboutBody({ values: [{ title: 'Excellence', body: '' }] }), /title and a description/);
    assert.throws(
      () =>
        validateAboutBody({
          facts: [
            { value: '2017', label: 'Founded' },
            { value: '30', label: 'founded' },
          ],
        }),
      /only once/
    );
  });

  it('refuses an unknown symbol and more facts or values than the page holds', () => {
    assert.throws(
      () => validateAboutBody({ values: [{ icon: 'star', title: 'Excellence', body: 'High standards.' }] }),
      /leaf/
    );
    const facts = Array.from({ length: FACT_MAX + 1 }, (_, index) => ({ value: String(index), label: `Fact ${index}` }));
    assert.throws(() => validateAboutBody({ facts }), /4 facts/);
    const values = Array.from({ length: VALUE_MAX + 1 }, (_, index) => ({
      icon: 'heart-outline',
      title: `Value ${index}`,
      body: 'A principle.',
    }));
    assert.throws(() => validateAboutBody({ values }), /6 values/);
  });
});
