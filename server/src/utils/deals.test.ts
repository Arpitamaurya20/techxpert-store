import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEAL_MAX, validateDealsBody } from './deals.js';

describe('validateDealsBody', () => {
  it('refuses a body that leaves the list out, and accepts an empty list', () => {
    assert.throws(() => validateDealsBody({}), /deals must be a list/);
    assert.throws(() => validateDealsBody(null), /deals must be a list/);
    assert.deepEqual(validateDealsBody({ deals: [] }), []);
  });

  it('trims a tile and drops one that is entirely blank', () => {
    const deals = validateDealsBody({
      deals: [
        {
          categoryId: ' 12 ',
          title: '  Desk tile ',
          highlight: '  Second ',
          tagline: '  A desk line ',
          tone: 'peach',
          imageUrl: ' /images/tile.jpg ',
        },
        { title: '', highlight: '', tagline: '', imageUrl: '' },
      ],
    });
    assert.deepEqual(deals, [
      {
        categoryId: 12,
        title: 'Desk tile',
        highlight: 'Second',
        tagline: 'A desk line',
        tone: 'peach',
        imageUrl: '/images/tile.jpg',
      },
    ]);
  });

  it('refuses a tile with no title, a repeated category, or an unknown colour', () => {
    assert.throws(() => validateDealsBody({ deals: [{ categoryId: 1, title: '', tone: 'peach' }] }), /title/);
    assert.throws(
      () =>
        validateDealsBody({
          deals: [
            { categoryId: 1, title: 'One', tone: 'peach' },
            { categoryId: 1, title: 'Two', tone: 'navy' },
          ],
        }),
      /different category/
    );
    assert.throws(() => validateDealsBody({ deals: [{ categoryId: 1, title: 'One', tone: 'red' }] }), /peach or navy/);
  });

  it('refuses a third tile', () => {
    const deals = Array.from({ length: DEAL_MAX + 1 }, (_, index) => ({
      categoryId: index + 1,
      title: `Tile ${index}`,
      tone: 'navy',
    }));
    assert.throws(() => validateDealsBody({ deals }), /2 tiles/);
  });
});
