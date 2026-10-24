import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PROJECT_MAX, SHORTCUT_MAX, validateHomeBody } from './homeMerch.js';

describe('validateHomeBody', () => {
  it('accepts an empty page', () => {
    assert.deepEqual(validateHomeBody({}), { shortcuts: [], projects: [] });
    assert.deepEqual(validateHomeBody(null), { shortcuts: [], projects: [] });
  });

  it('keeps shortcut order, a short name, and a project with its estimator', () => {
    const home = validateHomeBody({
      shortcuts: [
        { categoryId: '12', label: ' Cement ' },
        { categoryId: 4, label: '' },
      ],
      projects: [
        {
          title: ' Bathroom ',
          subtitle: ' Fittings and tiles ',
          imageUrl: 'https://cdn.example.com/bath.jpg',
          calculator: 'tiles',
          categoryIds: [12, '4'],
        },
      ],
    });
    assert.deepEqual(home.shortcuts, [
      { categoryId: 12, label: 'Cement' },
      { categoryId: 4, label: '' },
    ]);
    assert.equal(home.projects[0].title, 'Bathroom');
    assert.equal(home.projects[0].calculator, 'tiles');
    assert.deepEqual(home.projects[0].categoryIds, [12, 4]);
  });

  it('refuses a duplicate, a project with no category, and a bad image or estimator', () => {
    assert.throws(() => validateHomeBody({ shortcuts: [{ categoryId: 1 }, { categoryId: 1 }] }), /different category/);
    assert.throws(() => validateHomeBody({ projects: [{ title: 'Bath', categoryIds: [] }] }), /at least one category/);
    assert.throws(() => validateHomeBody({ projects: [{ title: 'Bath', categoryIds: [1, 1] }] }), /only once/);
    assert.throws(
      () => validateHomeBody({ projects: [{ title: 'Bath', imageUrl: 'not a url', categoryIds: [1] }] }),
      /image address/
    );
    assert.throws(
      () => validateHomeBody({ projects: [{ title: 'Bath', calculator: 'wood', categoryIds: [1] }] }),
      /estimator/
    );
  });

  it('refuses more than the home row or the project list can hold', () => {
    const shortcuts = Array.from({ length: SHORTCUT_MAX + 1 }, (_, i) => ({ categoryId: i + 1 }));
    assert.throws(() => validateHomeBody({ shortcuts }), /7 categories/);
    const projects = Array.from({ length: PROJECT_MAX + 1 }, (_, i) => ({
      title: `Project ${i}`,
      categoryIds: [1],
    }));
    assert.throws(() => validateHomeBody({ projects }), /12 projects/);
  });
});
