export type Level = 'view' | 'edit' | 'delete';

export const MODULES = [
  { key: 'products', label: 'Products', levels: ['view', 'edit', 'delete'] },
  { key: 'categories', label: 'Categories', levels: ['view', 'edit', 'delete'] },
  { key: 'orders', label: 'Orders', levels: ['view', 'edit'] },
  { key: 'delivery', label: 'Delivery pincodes', levels: ['view', 'edit'] },
  { key: 'stores', label: 'Stores & groups', levels: ['view', 'edit', 'delete'] },
  { key: 'customers', label: 'Customers', levels: ['view'] },
  { key: 'pricing', label: 'Bulk pricing', levels: ['view', 'edit', 'delete'] },
  { key: 'banners', label: 'Campaign banners', levels: ['view', 'edit', 'delete'] },
  { key: 'sections', label: 'Home screen sections', levels: ['view', 'edit', 'delete'] },
  { key: 'help', label: 'Help & support', levels: ['view', 'edit'] },
  { key: 'about', label: 'About the company', levels: ['view', 'edit'] },
  { key: 'audit', label: 'Audit trail', levels: ['view'] },
  { key: 'access', label: 'Roles & access', levels: ['view', 'edit', 'delete'] },
] as const satisfies readonly { key: string; label: string; levels: readonly Level[] }[];

export type ModuleKey = (typeof MODULES)[number]['key'];
export type ModuleGrant = { view: boolean; edit: boolean; delete: boolean };
export type Permissions = Record<ModuleKey, ModuleGrant>;

const LEVEL_LABEL: Record<Level, string> = { view: 'View', edit: 'Edit', delete: 'Delete' };

export function moduleLabel(module: ModuleKey): string {
  return MODULES.find((m) => m.key === module)?.label ?? module;
}

function allows(module: (typeof MODULES)[number], level: Level): boolean {
  return (module.levels as readonly Level[]).includes(level);
}

export function emptyPermissions(): Permissions {
  return Object.fromEntries(
    MODULES.map((m) => [m.key, { view: false, edit: false, delete: false }])
  ) as Permissions;
}

export function fullPermissions(): Permissions {
  return Object.fromEntries(
    MODULES.map((m) => [m.key, { view: true, edit: allows(m, 'edit'), delete: allows(m, 'delete') }])
  ) as Permissions;
}

/**
 * Keeps known modules and levels that module offers. Edit or delete turns view on.
 * Anything else in the input is ignored.
 */
export function normalizePermissions(input: unknown): Permissions {
  const result = emptyPermissions();
  if (!input || typeof input !== 'object') return result;
  const source = input as Record<string, unknown>;
  for (const module of MODULES) {
    const raw = source[module.key];
    if (!raw || typeof raw !== 'object') continue;
    const grant = raw as Record<string, unknown>;
    const edit = allows(module, 'edit') && grant.edit === true;
    const del = allows(module, 'delete') && grant.delete === true;
    result[module.key] = { view: grant.view === true || edit || del, edit, delete: del };
  }
  return result;
}

export function permissionsFromRows(
  rows: { module: string; canView: unknown; canEdit: unknown; canDelete: unknown }[]
): Permissions {
  const input: Record<string, unknown> = {};
  for (const row of rows) {
    input[row.module] = {
      view: Number(row.canView) === 1,
      edit: Number(row.canEdit) === 1,
      delete: Number(row.canDelete) === 1,
    };
  }
  return normalizePermissions(input);
}

export function can(permissions: Permissions, module: ModuleKey, level: Level): boolean {
  return permissions[module]?.[level] === true;
}

export function hasAnyAccess(permissions: Permissions): boolean {
  return MODULES.some((m) => permissions[m.key].view);
}

/** Every grant in `requested` that `holder` does not have, as "Orders: Edit". */
export function grantsBeyond(requested: Permissions, holder: Permissions): string[] {
  const beyond: string[] = [];
  for (const module of MODULES) {
    for (const level of module.levels) {
      if (requested[module.key][level] && !holder[module.key][level]) {
        beyond.push(`${module.label}: ${LEVEL_LABEL[level]}`);
      }
    }
  }
  return beyond;
}
