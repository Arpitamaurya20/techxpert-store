import type { TabId } from '../components/Sidebar';

export type Level = 'view' | 'edit' | 'delete';

export type ModuleKey =
  | 'products'
  | 'categories'
  | 'orders'
  | 'delivery'
  | 'customers'
  | 'pricing'
  | 'banners'
  | 'sections'
  | 'audit'
  | 'api'
  | 'access';

export type ModuleGrant = { view: boolean; edit: boolean; delete: boolean };
export type Permissions = Partial<Record<ModuleKey, ModuleGrant>>;

export type ModuleInfo = { key: ModuleKey; label: string; levels: Level[] };

/** Which module decides whether a tab shows. Dashboard shows when any module does. */
const TAB_MODULE: Record<Exclude<TabId, 'dashboard'>, ModuleKey> = {
  catalog: 'products',
  categories: 'categories',
  orders: 'orders',
  delivery: 'delivery',
  users: 'customers',
  pricing: 'pricing',
  banners: 'banners',
  sections: 'sections',
  api: 'api',
  audit: 'audit',
  access: 'access',
};

export const TAB_ORDER: TabId[] = [
  'dashboard',
  'catalog',
  'categories',
  'orders',
  'delivery',
  'users',
  'pricing',
  'banners',
  'sections',
  'api',
  'audit',
  'access',
];

export function can(permissions: Permissions | undefined, module: ModuleKey, level: Level): boolean {
  return permissions?.[module]?.[level] === true;
}

export function hasAnyAccess(permissions: Permissions | undefined): boolean {
  return Object.values(permissions ?? {}).some((grant) => grant?.view);
}

export function canOpenTab(permissions: Permissions | undefined, tab: TabId): boolean {
  if (tab === 'dashboard') return hasAnyAccess(permissions);
  return can(permissions, TAB_MODULE[tab], 'view');
}

/** True when every grant in `role` is also held by `holder` (no escalation). */
export function isWithin(role: Permissions, holder: Permissions | undefined): boolean {
  return (Object.keys(role) as ModuleKey[]).every((module) =>
    (['view', 'edit', 'delete'] as Level[]).every((level) => !role[module]?.[level] || can(holder, module, level))
  );
}

export function allowedTabs(permissions: Permissions | undefined): TabId[] {
  return TAB_ORDER.filter((tab) => canOpenTab(permissions, tab));
}
