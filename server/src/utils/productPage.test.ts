import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { productPageUpdates } from './productPage.js';

function refusal(run: () => void, pattern: RegExp) {
  assert.throws(run, (err: unknown) => {
    assert.match((err as Error).message, pattern);
    return true;
  });
}

describe('productPageUpdates', () => {
  it('leaves both lists alone when the save does not mention them', () => {
    assert.deepEqual(productPageUpdates({ name: 'Fan' }), {});
    assert.deepEqual(productPageUpdates(null), {});
  });

  it('keeps the points and the specification rows, and drops blanks', () => {
    assert.deepEqual(
      productPageUpdates({
        highlights: [' Remote control ', '', '  3 speeds  '],
        specifications: [
          { label: ' Sweep ', value: ' 48 inch ' },
          { label: ' ', value: ' ' },
        ],
      }),
      {
        highlights: ['Remote control', '3 speeds'],
        specifications: [{ label: 'Sweep', value: '48 inch' }],
      }
    );
  });

  it('an empty list clears that part of the page', () => {
    assert.deepEqual(productPageUpdates({ highlights: [], specifications: [] }), {
      highlights: [],
      specifications: [],
    });
  });

  it('refuses a half-filled specification, too many rows, and text that is not a list', () => {
    refusal(() => productPageUpdates({ specifications: [{ label: 'Sweep', value: '' }] }), /name and a value/);
    refusal(
      () => productPageUpdates({ highlights: Array.from({ length: 9 }, () => 'Point') }),
      /8 highlights/
    );
    refusal(
      () => productPageUpdates({ specifications: Array.from({ length: 17 }, (_, i) => ({ label: `L${i}`, value: 'v' })) }),
      /16 specifications/
    );
    refusal(() => productPageUpdates({ highlights: 'Remote' }), /list/);
    refusal(() => productPageUpdates({ highlights: ['x'.repeat(161)] }), /160/);
  });
});
