import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MAX_GROUP_DEPTH,
  WHOLE_COMPANY,
  coversGroup,
  coversNodes,
  coversStore,
  groupsUnder,
  noScope,
  parseScopeNodes,
  placementRefusal,
  resolveScope,
  scopeWithin,
  storeFilter,
  type GroupRow,
  type StoreTree,
} from './scope.js';

// North (1) > Area A (2) > Cluster (4); North > Area B (3); South (5). Stores: 10, 11 in A; 12 in B; 13 in South; 14 top level.
const groups: GroupRow[] = [
  { id: 1, parentId: null },
  { id: 2, parentId: 1 },
  { id: 3, parentId: 1 },
  { id: 4, parentId: 2 },
  { id: 5, parentId: null },
];
const tree: StoreTree = {
  groups,
  stores: [
    { id: 10, groupId: 2 },
    { id: 11, groupId: 4 },
    { id: 12, groupId: 3 },
    { id: 13, groupId: 5 },
    { id: 14, groupId: null },
  ],
};

describe('resolveScope', () => {
  it('covers every store under a group at any depth', () => {
    const scope = resolveScope(false, [{ type: 'group', id: 1 }], tree);
    assert.equal(scope.all, false);
    assert.deepEqual(storeFilter(scope)?.sort(), [10, 11, 12]);
    assert.equal(coversGroup(scope, 4), true);
    assert.equal(coversGroup(scope, 5), false);
  });

  it('adds single stores to group coverage', () => {
    const scope = resolveScope(false, [{ type: 'group', id: 3 }, { type: 'store', id: 14 }], tree);
    assert.deepEqual(storeFilter(scope)?.sort(), [12, 14]);
  });

  it('includes a store placed later under a covered group', () => {
    const later: StoreTree = { groups, stores: [...tree.stores, { id: 15, groupId: 4 }] };
    assert.equal(coversStore(resolveScope(false, [{ type: 'group', id: 2 }], later), 15), true);
  });

  it('gives nothing for no places, and ignores places that no longer exist', () => {
    assert.deepEqual(storeFilter(resolveScope(false, [], tree)), []);
    assert.deepEqual(storeFilter(resolveScope(false, [{ type: 'group', id: 99 }, { type: 'store', id: 98 }], tree)), []);
  });

  it('whole company has no filter and covers the top level', () => {
    const scope = resolveScope(true, [], tree);
    assert.equal(storeFilter(scope), null);
    assert.equal(coversGroup(scope, null), true);
    assert.equal(coversGroup(resolveScope(false, [{ type: 'group', id: 1 }], tree), null), false);
  });
});

describe('scopeWithin', () => {
  const north = resolveScope(false, [{ type: 'group', id: 1 }], tree);
  const areaA = resolveScope(false, [{ type: 'group', id: 2 }], tree);
  const storeInSouth = resolveScope(false, [{ type: 'store', id: 13 }], tree);

  it('a smaller place is within a larger one', () => {
    assert.equal(scopeWithin(areaA, north), true);
    assert.equal(scopeWithin(north, areaA), false);
  });

  it('whole company is only within whole company', () => {
    assert.equal(scopeWithin(WHOLE_COMPANY, north), false);
    assert.equal(scopeWithin(north, WHOLE_COMPANY), true);
  });

  it('a store elsewhere is not within', () => {
    assert.equal(scopeWithin(storeInSouth, north), false);
    assert.equal(scopeWithin(noScope(), north), true);
  });

  it('coversNodes checks each requested place', () => {
    assert.equal(coversNodes(north, [{ type: 'group', id: 4 }, { type: 'store', id: 12 }]), true);
    assert.equal(coversNodes(north, [{ type: 'store', id: 13 }]), false);
  });
});

describe('groupsUnder', () => {
  it('stops on a cycle in bad data', () => {
    const looped: GroupRow[] = [{ id: 1, parentId: 2 }, { id: 2, parentId: 1 }];
    assert.deepEqual([...groupsUnder([1], looped)].sort(), [1, 2]);
  });
});

describe('placementRefusal', () => {
  it('refuses moving a group inside itself or its descendants', () => {
    assert.match(placementRefusal(1, 4, groups) ?? '', /inside itself/);
    assert.match(placementRefusal(2, 2, groups) ?? '', /inside itself/);
    assert.equal(placementRefusal(3, 5, groups), null);
  });

  it('refuses a parent that does not exist', () => {
    assert.match(placementRefusal(null, 42, groups) ?? '', /no longer exists/);
  });

  it(`limits nesting to ${MAX_GROUP_DEPTH} levels, counting the moved subtree`, () => {
    const chain: GroupRow[] = Array.from({ length: MAX_GROUP_DEPTH }, (_, i) => ({
      id: i + 1,
      parentId: i === 0 ? null : i,
    }));
    assert.match(placementRefusal(null, MAX_GROUP_DEPTH, chain) ?? '', /at most/);
    assert.equal(placementRefusal(null, MAX_GROUP_DEPTH - 1, chain), null);
    const withBranch = [...chain, { id: 100, parentId: null }, { id: 101, parentId: 100 }];
    assert.match(placementRefusal(100, MAX_GROUP_DEPTH - 1, withBranch) ?? '', /at most/);
  });
});

describe('parseScopeNodes', () => {
  it('accepts groups and stores, dropping repeats', () => {
    assert.deepEqual(parseScopeNodes([{ type: 'group', id: 1 }, { type: 'group', id: 1 }, { type: 'store', id: 2 }]), [
      { type: 'group', id: 1 },
      { type: 'store', id: 2 },
    ]);
  });

  it('rejects anything else', () => {
    assert.equal(parseScopeNodes('all'), null);
    assert.equal(parseScopeNodes([{ type: 'zone', id: 1 }]), null);
    assert.equal(parseScopeNodes([{ type: 'store', id: '2' }]), null);
    assert.equal(parseScopeNodes([{ type: 'store', id: 0 }]), null);
  });
});
