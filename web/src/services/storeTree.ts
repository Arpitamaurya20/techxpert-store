import type { StoreGroup } from './api';

/** The group and every group nested under it. */
export function groupAndBelow(groupId: number, groups: StoreGroup[]): Set<number> {
  const found = new Set<number>([groupId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const g of groups) {
      if (g.parentId != null && found.has(g.parentId) && !found.has(g.id)) {
        found.add(g.id);
        grew = true;
      }
    }
  }
  return found;
}

/** "North › Area A", using only the groups this person can see. */
export function groupPath(groupId: number, groups: StoreGroup[]): string {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const names: string[] = [];
  let current = byId.get(groupId);
  const seen = new Set<number>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    names.unshift(current.name);
    current = current.parentId != null ? byId.get(current.parentId) : undefined;
  }
  return names.join(' › ');
}
