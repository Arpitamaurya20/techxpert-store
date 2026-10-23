import React, { useCallback, useEffect, useState } from 'react';
import { MapPin, Pencil, Plus, RefreshCw, ShieldCheck, Trash2, Users } from 'lucide-react';
import { api, type PortalRole, type ScopeNode, type StaffMember, type StoreTree } from '../services/api';
import { can, isWithin, type Level, type ModuleInfo, type Permissions } from '../services/access';
import { groupAndBelow } from '../services/storeTree';
import { Badge, Button, EmptyState, Modal, StatGrid, useToast } from './ui';
import type { StatItem } from './ui';

interface AccessManagerProps {
  /** The signed-in staff member's own grants; the role editor never offers more. */
  permissions: Permissions;
  canEdit: boolean;
  canDelete: boolean;
}

type RoleDraft = { id: number | null; name: string; description: string; permissions: Permissions };
type PlacesDraft = { member: StaffMember; all: boolean; picked: Set<string> };

const nodeKey = (node: ScopeNode) => `${node.type}:${node.id}`;

function placesLabel(member: StaffMember): string {
  if (member.isSuperAdmin || member.scope.all) return 'Whole company';
  if (member.scope.nodes.length === 0) return 'No places — sees no orders, pincodes or customers';
  return member.scope.nodes.map((n) => n.name).join(', ');
}

const LEVELS: Level[] = ['view', 'edit', 'delete'];
const LEVEL_LABEL: Record<Level, string> = { view: 'View', edit: 'Edit', delete: 'Delete' };

function summary(role: PortalRole, modules: ModuleInfo[]): string {
  const parts = modules
    .filter((m) => role.permissions[m.key]?.view)
    .map((m) => {
      const grant = role.permissions[m.key]!;
      const top = grant.delete ? 'delete' : grant.edit ? 'edit' : 'view';
      return `${m.label}: ${top}`;
    });
  return parts.length ? parts.join(' · ') : 'No modules';
}

export const AccessManager: React.FC<AccessManagerProps> = ({ permissions, canEdit, canDelete }) => {
  const toast = useToast();
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [roles, setRoles] = useState<PortalRole[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<RoleDraft | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyStaffId, setBusyStaffId] = useState<number | null>(null);
  const [tree, setTree] = useState<StoreTree | null>(null);
  const [places, setPlaces] = useState<PlacesDraft | null>(null);
  const [placesError, setPlacesError] = useState<string | null>(null);
  /** The places picker lists your own groups and stores, which needs Stores view. */
  const canPickPlaces = canEdit && can(permissions, 'stores', 'view');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [roleData, staffData] = await Promise.all([api.getAccessRoles(), api.getAccessStaff()]);
      setModules(roleData.modules);
      setRoles(roleData.roles);
      setStaff(staffData);
    } catch (err: any) {
      setLoadError(err.message || 'Could not load roles and staff');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeStaff = staff.filter((s) => s.active);
  const stats: StatItem[] = [
    { label: 'Roles', value: roles.length, icon: <ShieldCheck size={20} />, iconColor: 'var(--accent)' },
    {
      label: 'Active staff with a role',
      value: `${activeStaff.filter((s) => s.roleId || s.isSuperAdmin).length} / ${activeStaff.length}`,
      icon: <Users size={20} />,
      iconColor: 'var(--success)',
    },
  ];

  const openNew = () => {
    setDraftError(null);
    setDraft({ id: null, name: '', description: '', permissions: {} });
  };

  const openEdit = (role: PortalRole) => {
    setDraftError(null);
    setDraft({ id: role.id, name: role.name, description: role.description, permissions: { ...role.permissions } });
  };

  const toggleGrant = (module: ModuleInfo, level: Level) => {
    setDraft((current) => {
      if (!current) return current;
      const grant = { view: false, edit: false, delete: false, ...current.permissions[module.key] };
      const next = !grant[level];
      if (level === 'view') {
        grant.view = next;
        if (!next) {
          grant.edit = false;
          grant.delete = false;
        }
      } else {
        grant[level] = next;
        if (next) grant.view = true;
      }
      return { ...current, permissions: { ...current.permissions, [module.key]: grant } };
    });
  };

  const saveDraft = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (name.length < 2) {
      setDraftError('Give the role a name of at least 2 characters.');
      return;
    }
    if (!modules.some((m) => draft.permissions[m.key]?.view)) {
      setDraftError('Give the role at least one module.');
      return;
    }
    try {
      setSaving(true);
      setDraftError(null);
      const body = { name, description: draft.description.trim(), permissions: draft.permissions };
      if (draft.id == null) {
        await api.createAccessRole(body);
        toast.success(`Role "${name}" created.`);
      } else {
        await api.updateAccessRole(draft.id, body);
        toast.success(`Role "${name}" saved. Staff holding it see the change on their next action.`);
      }
      setDraft(null);
      await load();
    } catch (err: any) {
      setDraftError(err.message || 'Could not save this role');
    } finally {
      setSaving(false);
    }
  };

  const removeRole = async (role: PortalRole) => {
    if (!window.confirm(`Delete the role "${role.name}"?`)) return;
    try {
      await api.deleteAccessRole(role.id);
      toast.success(`Role "${role.name}" deleted.`);
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Could not delete this role');
    }
  };

  const assign = async (member: StaffMember, value: string) => {
    const roleId = value === '' ? null : Number(value);
    try {
      setBusyStaffId(member.id);
      const saved = await api.assignStaffRole(member.id, roleId);
      setStaff((prev) => prev.map((s) => (s.id === member.id ? saved : s)));
      toast.success(roleId == null ? `${member.name} no longer has portal access.` : `${member.name} now has "${saved.roleName}".`);
      const roleData = await api.getAccessRoles();
      setRoles(roleData.roles);
    } catch (err: any) {
      toast.error(err.message || `Could not change ${member.name}'s role`);
    } finally {
      setBusyStaffId(null);
    }
  };

  const openPlaces = async (member: StaffMember) => {
    setPlacesError(null);
    setPlaces({ member, all: member.scope.all, picked: new Set(member.scope.nodes.map(nodeKey)) });
    try {
      setTree(await api.getStoreTree());
    } catch (err: any) {
      setPlacesError(err.message || 'Could not load your groups and stores');
    }
  };

  const togglePlace = (node: ScopeNode) => {
    setPlaces((current) => {
      if (!current) return current;
      const picked = new Set(current.picked);
      const key = nodeKey(node);
      if (picked.has(key)) picked.delete(key);
      else picked.add(key);
      return { ...current, picked };
    });
  };

  const savePlaces = async () => {
    if (!places) return;
    const nodes: ScopeNode[] = [...places.picked].map((key) => {
      const [type, id] = key.split(':');
      return { type: type as ScopeNode['type'], id: Number(id) };
    });
    try {
      setSaving(true);
      setPlacesError(null);
      const saved = await api.setStaffScope(places.member.id, { all: places.all, nodes: places.all ? [] : nodes });
      setStaff((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
      toast.success(`${saved.name} now covers: ${placesLabel(saved)}.`);
      setPlaces(null);
    } catch (err: any) {
      setPlacesError(err.message || 'Could not save these places');
    } finally {
      setSaving(false);
    }
  };

  /** Groups and stores under a picked group are already covered by it. */
  const coveredByPick = (() => {
    const covered = new Set<string>();
    if (!places || !tree) return covered;
    for (const g of tree.groups) {
      if (!places.picked.has(`group:${g.id}`)) continue;
      for (const id of groupAndBelow(g.id, tree.groups)) if (id !== g.id) covered.add(`group:${id}`);
    }
    for (const s of tree.stores) {
      if (s.groupId != null && (places.picked.has(`group:${s.groupId}`) || covered.has(`group:${s.groupId}`))) {
        covered.add(`store:${s.id}`);
      }
    }
    return covered;
  })();

  const renderPlaces = (parentId: number | null, depth: number): React.ReactNode => {
    if (!tree) return null;
    const visible = new Set(tree.groups.map((g) => g.id));
    const groups = tree.groups.filter((g) =>
      parentId == null ? g.parentId == null || !visible.has(g.parentId) : g.parentId === parentId
    );
    const stores = tree.stores.filter((s) =>
      parentId == null ? s.groupId == null || !visible.has(s.groupId) : s.groupId === parentId
    );
    const option = (node: ScopeNode, label: string, hint: string) => {
      const key = nodeKey(node);
      const covered = coveredByPick.has(key);
      return (
        <label key={key} style={{ ...styles.placeRow, paddingLeft: 8 + depth * 20 }}>
          <input
            type="checkbox"
            checked={covered || places?.picked.has(key) === true}
            disabled={covered}
            onChange={() => togglePlace(node)}
          />
          <span style={{ color: 'var(--text-main)' }}>{label}</span>
          <span style={styles.count}>{covered ? 'covered by a group above' : hint}</span>
        </label>
      );
    };
    return (
      <>
        {groups.map((g) => (
          <React.Fragment key={`g${g.id}`}>
            {option({ type: 'group', id: g.id }, g.name, g.kind ? `${g.kind} · everything inside` : 'everything inside')}
            {renderPlaces(g.id, depth + 1)}
          </React.Fragment>
        ))}
        {stores.map((s) => option({ type: 'store', id: s.id }, s.name, `${s.code}${s.active ? '' : ' · inactive'}`))}
      </>
    );
  };

  if (loading && roles.length === 0) {
    return <div style={styles.muted}>Loading roles and staff…</div>;
  }
  if (loadError) {
    return <div style={{ ...styles.panel, ...styles.error }}>{loadError}</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <StatGrid items={stats} columns={2} />

      <div style={styles.toolbar}>
        <p style={styles.hint}>
          A role decides which portal modules someone sees and whether they can edit or delete there. Super admin
          always has everything. You can only give out access you have yourself, and you can't change your own role.
        </p>
        <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={load} disabled={loading}>
          Refresh
        </Button>
      </div>

      <div style={styles.panel}>
        <div style={styles.panelHeader}>
          <h3 style={styles.panelTitle}>Roles</h3>
          {canEdit ? (
            <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={openNew}>
              New role
            </Button>
          ) : null}
        </div>
        {roles.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck size={22} />}
            title="No roles yet"
            description="Create a role, pick its modules, then give it to staff below."
          />
        ) : (
          <div style={styles.list}>
            {roles.map((role) => (
              <div key={role.id} style={styles.row}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.name}>
                    {role.name}
                    <span style={styles.count}>
                      {role.staffCount} {role.staffCount === 1 ? 'person' : 'people'}
                    </span>
                  </div>
                  {role.description ? <div style={styles.meta}>{role.description}</div> : null}
                  <div style={styles.grants}>{summary(role, modules)}</div>
                </div>
                {canEdit && role.manageable ? (
                  <Button variant="secondary" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(role)}>
                    Edit
                  </Button>
                ) : null}
                {canDelete && role.manageable ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 size={13} color="var(--danger)" />}
                    disabled={role.staffCount > 0}
                    title={role.staffCount > 0 ? 'Move everyone off this role before deleting it' : 'Delete role'}
                    onClick={() => removeRole(role)}
                  />
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={styles.panel}>
        <div style={styles.panelHeader}>
          <h3 style={styles.panelTitle}>Staff</h3>
        </div>
        <p style={styles.hint}>
          Staff logins come from the shared admin accounts. Creating or deactivating a login stays where it is today.
        </p>
        <div style={styles.list}>
          {staff.map((member) => (
            <div key={member.id} style={{ ...styles.row, opacity: member.active ? 1 : 0.55 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={styles.name}>
                  {member.name}
                  {!member.active ? (
                    <Badge variant="neutral" size="sm">
                      Inactive login
                    </Badge>
                  ) : null}
                </div>
                <div style={styles.meta}>{member.email}</div>
                {member.isSuperAdmin || member.roleId != null ? (
                  <div style={styles.grants}>
                    <MapPin size={11} style={{ verticalAlign: '-1px', marginRight: 4 }} />
                    {placesLabel(member)}
                  </div>
                ) : null}
              </div>
              {!member.isSuperAdmin && member.roleId != null && canPickPlaces && member.changeable ? (
                <Button variant="secondary" size="sm" icon={<MapPin size={13} />} onClick={() => openPlaces(member)}>
                  Places
                </Button>
              ) : null}
              {member.isSuperAdmin ? (
                <Badge variant="brand">Super admin · everything</Badge>
              ) : canEdit && member.changeable ? (
                <select
                  style={styles.select}
                  value={member.roleId == null ? '' : String(member.roleId)}
                  disabled={busyStaffId === member.id}
                  onChange={(e) => assign(member, e.target.value)}
                  aria-label={`Role for ${member.name}`}
                >
                  <option value="">No portal access</option>
                  {roles.map((role) => (
                    <option
                      key={role.id}
                      value={String(role.id)}
                      disabled={!isWithin(role.permissions, permissions) && role.id !== member.roleId}
                    >
                      {role.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span style={styles.fixedRole}>{member.roleName ?? 'No portal access'}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <Modal
        isOpen={draft != null}
        onClose={() => setDraft(null)}
        title={draft?.id == null ? 'New role' : `Edit "${roles.find((r) => r.id === draft?.id)?.name ?? 'role'}"`}
        subtitle="Edit and Delete include View. Greyed boxes are access you don't have yourself."
        maxWidth="640px"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" loading={saving} onClick={saveDraft}>
              {draft?.id == null ? 'Create role' : 'Save role'}
            </Button>
          </>
        }
      >
        {draft ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={styles.label} htmlFor="role-name">
                Name
              </label>
              <input
                id="role-name"
                style={styles.input}
                maxLength={80}
                placeholder="Store manager"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div>
              <label style={styles.label} htmlFor="role-description">
                What this role is for (optional)
              </label>
              <input
                id="role-description"
                style={styles.input}
                maxLength={255}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </div>
            <table style={styles.grid}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, textAlign: 'left' }}>Module</th>
                  {LEVELS.map((level) => (
                    <th key={level} style={styles.th}>
                      {LEVEL_LABEL[level]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modules.map((module) => (
                  <tr key={module.key}>
                    <td style={styles.td}>{module.label}</td>
                    {LEVELS.map((level) => (
                      <td key={level} style={{ ...styles.td, textAlign: 'center' }}>
                        {module.levels.includes(level) ? (
                          <input
                            type="checkbox"
                            aria-label={`${module.label} ${LEVEL_LABEL[level]}`}
                            checked={draft.permissions[module.key]?.[level] === true}
                            disabled={!can(permissions, module.key, level)}
                            onChange={() => toggleGrant(module, level)}
                          />
                        ) : (
                          <span style={styles.dash}>—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {draftError ? <p style={styles.error}>{draftError}</p> : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={places != null}
        onClose={() => setPlaces(null)}
        title={places ? `Places for ${places.member.name}` : 'Places'}
        subtitle="Which stores' orders, delivery pincodes and customers this person sees. A group covers every store inside it, including ones added later."
        maxWidth="560px"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setPlaces(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" loading={saving} onClick={savePlaces} disabled={!tree}>
              Save places
            </Button>
          </>
        }
      >
        {places ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={styles.placeRow}>
              <input
                type="checkbox"
                checked={places.all}
                disabled={!tree?.wholeCompany && !places.all}
                onChange={() => setPlaces({ ...places, all: !places.all })}
              />
              <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>Whole company</span>
              <span style={styles.count}>
                {tree && !tree.wholeCompany ? 'only whole-company staff can give this' : 'every store, now and later'}
              </span>
            </label>
            {!places.all ? (
              tree ? (
                tree.groups.length === 0 && tree.stores.length === 0 ? (
                  <p style={styles.hint}>You have no groups or stores to give. Add them under Stores &amp; Groups.</p>
                ) : (
                  <div style={styles.placeList}>{renderPlaces(null, 0)}</div>
                )
              ) : placesError ? null : (
                <div style={styles.muted}>Loading your groups and stores…</div>
              )
            ) : null}
            {!places.all && places.picked.size === 0 && tree ? (
              <p style={styles.hint}>With nothing ticked, this person sees no orders, pincodes or customers.</p>
            ) : null}
            {placesError ? <p style={styles.error}>{placesError}</p> : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  hint: {
    margin: 0,
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
    maxWidth: '720px',
    lineHeight: 1.45,
  },
  panel: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  panelTitle: {
    margin: 0,
    fontSize: '0.98rem',
    fontWeight: 700,
    color: 'var(--text-main)',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--tint-1)',
    border: '1px solid var(--border-subtle)',
  },
  name: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'var(--text-main)',
  },
  count: {
    fontSize: '0.74rem',
    fontWeight: 500,
    color: 'var(--text-dim)',
  },
  meta: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
  grants: {
    fontSize: '0.76rem',
    color: 'var(--text-dim)',
    marginTop: '4px',
    lineHeight: 1.4,
  },
  select: {
    background: 'var(--tint-2)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: '7px 10px',
    color: 'var(--text-main)',
    fontSize: '0.84rem',
    minWidth: '200px',
  },
  fixedRole: {
    fontSize: '0.84rem',
    color: 'var(--text-muted)',
  },
  label: {
    display: 'block',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    background: 'var(--tint-2)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: '9px 14px',
    color: 'var(--text-main)',
    fontSize: '0.86rem',
    outline: 'none',
  },
  grid: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    fontSize: '0.74rem',
    fontWeight: 700,
    color: 'var(--text-dim)',
    padding: '6px 8px',
    borderBottom: '1px solid var(--border-subtle)',
    textAlign: 'center',
  },
  td: {
    fontSize: '0.84rem',
    color: 'var(--text-main)',
    padding: '7px 8px',
    borderBottom: '1px solid var(--tint-2)',
  },
  dash: {
    color: 'var(--text-dim)',
  },
  placeList: {
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '360px',
    overflowY: 'auto',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
  },
  placeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '7px 8px',
    fontSize: '0.86rem',
    cursor: 'pointer',
  },
  muted: {
    color: 'var(--text-dim)',
    fontSize: '0.86rem',
    padding: '24px',
    textAlign: 'center',
  },
  error: {
    margin: 0,
    color: 'var(--danger)',
    fontSize: '0.82rem',
  },
};
