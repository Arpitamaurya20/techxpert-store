export type ScopeNode = { type: 'group' | 'store'; id: number };
export type GroupRow = { id: number; parentId: number | null };
export type StorePlacement = { id: number; groupId: number | null };
export type StoreTree = { groups: GroupRow[]; stores: StorePlacement[] };

/** Whole company, or the groups and stores a staff member covers (everything under a group included). */
export type Scope = { all: true } | { all: false; groupIds: Set<number>; storeIds: Set<number> };

export const MAX_GROUP_DEPTH = 8;

export const WHOLE_COMPANY: Scope = { all: true };

export function noScope(): Scope {
  return { all: false, groupIds: new Set(), storeIds: new Set() };
}

function childrenByParent(groups: GroupRow[]): Map<number, number[]> {
  const children = new Map<number, number[]>();
  for (const g of groups) {
    if (g.parentId == null) continue;
    children.set(g.parentId, [...(children.get(g.parentId) ?? []), g.id]);
  }
  return children;
}

/** The given groups and every group below them. */
export function groupsUnder(roots: Iterable<number>, groups: GroupRow[]): Set<number> {
  const children = childrenByParent(groups);
  const known = new Set(groups.map((g) => g.id));
  const found = new Set<number>();
  const queue = [...roots].filter((id) => known.has(id));
  while (queue.length) {
    const id = queue.pop()!;
    if (found.has(id)) continue;
    found.add(id);
    queue.push(...(children.get(id) ?? []));
  }
  return found;
}

export function resolveScope(all: boolean, nodes: ScopeNode[], tree: StoreTree): Scope {
  if (all) return WHOLE_COMPANY;
  const groupIds = groupsUnder(
    nodes.filter((n) => n.type === 'group').map((n) => n.id),
    tree.groups
  );
  const knownStores = new Set(tree.stores.map((s) => s.id));
  const storeIds = new Set(nodes.filter((n) => n.type === 'store' && knownStores.has(n.id)).map((n) => n.id));
  for (const s of tree.stores) {
    if (s.groupId != null && groupIds.has(s.groupId)) storeIds.add(s.id);
  }
  return { all: false, groupIds, storeIds };
}

/** `null` means the top level, which only whole-company staff cover. */
export function coversGroup(scope: Scope, groupId: number | null): boolean {
  if (scope.all) return true;
  return groupId != null && scope.groupIds.has(groupId);
}

export function coversStore(scope: Scope, storeId: number): boolean {
  return scope.all || scope.storeIds.has(storeId);
}

export function coversNodes(scope: Scope, nodes: ScopeNode[]): boolean {
  return nodes.every((n) => (n.type === 'group' ? coversGroup(scope, n.id) : coversStore(scope, n.id)));
}

/** Everything `inner` covers is also covered by `outer`. */
export function scopeWithin(inner: Scope, outer: Scope): boolean {
  if (outer.all) return true;
  if (inner.all) return false;
  for (const id of inner.groupIds) if (!outer.groupIds.has(id)) return false;
  for (const id of inner.storeIds) if (!outer.storeIds.has(id)) return false;
  return true;
}

/** Store ids to filter by, or null for no filter. */
export function storeFilter(scope: Scope): number[] | null {
  return scope.all ? null : [...scope.storeIds];
}

/** 1 for a top-level group. */
export function groupDepth(groupId: number, groups: GroupRow[]): number {
  const parent = new Map(groups.map((g) => [g.id, g.parentId]));
  let depth = 0;
  let current: number | null | undefined = groupId;
  const seen = new Set<number>();
  while (current != null && !seen.has(current)) {
    seen.add(current);
    depth += 1;
    current = parent.get(current);
  }
  return depth;
}

/** Levels in the subtree starting at this group: 1 when it has no child groups. */
export function subtreeHeight(groupId: number, groups: GroupRow[]): number {
  const children = childrenByParent(groups);
  const height = (id: number, seen: Set<number>): number => {
    if (seen.has(id)) return 0;
    seen.add(id);
    const kids = children.get(id) ?? [];
    return 1 + (kids.length ? Math.max(...kids.map((k) => height(k, seen))) : 0);
  };
  return height(groupId, new Set());
}

/** Why a group can't be put under `parentId` (null = top level), or null when it can. */
export function placementRefusal(groupId: number | null, parentId: number | null, groups: GroupRow[]): string | null {
  if (parentId != null && !groups.some((g) => g.id === parentId)) return 'That parent group no longer exists.';
  if (groupId != null && parentId != null && groupsUnder([groupId], groups).has(parentId)) {
    return "A group can't be moved inside itself.";
  }
  const parentDepth = parentId == null ? 0 : groupDepth(parentId, groups);
  const height = groupId == null ? 1 : subtreeHeight(groupId, groups);
  if (parentDepth + height > MAX_GROUP_DEPTH) return `Groups can be nested at most ${MAX_GROUP_DEPTH} deep.`;
  return null;
}

/** Cleans `[{ type, id }]` from a request; null when the shape is wrong. */
export function parseScopeNodes(input: unknown): ScopeNode[] | null {
  if (!Array.isArray(input)) return null;
  const nodes: ScopeNode[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    const type = raw?.type;
    const id = raw?.id;
    if ((type !== 'group' && type !== 'store') || !Number.isInteger(id) || id <= 0) return null;
    const key = `${type}:${id}`;
    if (!seen.has(key)) {
      seen.add(key);
      nodes.push({ type, id });
    }
  }
  return nodes;
}
