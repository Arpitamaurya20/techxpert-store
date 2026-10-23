import React, { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, RefreshCw, ShieldCheck, Trash2, Users } from 'lucide-react';
import { api, type PortalRole, type StaffMember } from '../services/api';
import { can, isWithin, type Level, type ModuleInfo, type Permissions } from '../services/access';
import { Badge, Button, EmptyState, Modal, StatGrid } from './ui';
import type { StatItem } from './ui';

interface AccessManagerProps {
  /** The signed-in staff member's own grants; the role editor never offers more. */
  permissions: Permissions;
  canEdit: boolean;
  canDelete: boolean;
  onToast?: (message: string) => void;
}

type RoleDraft = { id: number | null; name: string; description: string; permissions: Permissions };

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

export const AccessManager: React.FC<AccessManagerProps> = ({ permissions, canEdit, canDelete, onToast }) => {
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [roles, setRoles] = useState<PortalRole[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<RoleDraft | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyStaffId, setBusyStaffId] = useState<number | null>(null);

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
    { label: 'Roles', value: roles.length, icon: <ShieldCheck size={20} />, iconColor: 'var(--brand-orange)' },
    {
      label: 'Active staff with a role',
      value: `${activeStaff.filter((s) => s.roleId || s.isSuperAdmin).length} / ${activeStaff.length}`,
      icon: <Users size={20} />,
      iconColor: '#10b981',
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
        onToast?.(`Role "${name}" created.`);
      } else {
        await api.updateAccessRole(draft.id, body);
        onToast?.(`Role "${name}" saved. Staff holding it see the change on their next action.`);
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
      onToast?.(`Role "${role.name}" deleted.`);
      await load();
    } catch (err: any) {
      onToast?.(err.message || 'Could not delete this role');
    }
  };

  const assign = async (member: StaffMember, value: string) => {
    const roleId = value === '' ? null : Number(value);
    try {
      setBusyStaffId(member.id);
      const saved = await api.assignStaffRole(member.id, roleId);
      setStaff((prev) => prev.map((s) => (s.id === member.id ? saved : s)));
      onToast?.(roleId == null ? `${member.name} no longer has portal access.` : `${member.name} now has "${saved.roleName}".`);
      const roleData = await api.getAccessRoles();
      setRoles(roleData.roles);
    } catch (err: any) {
      onToast?.(err.message || `Could not change ${member.name}'s role`);
    } finally {
      setBusyStaffId(null);
    }
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
                    icon={<Trash2 size={13} color="#f43f5e" />}
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
              </div>
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
    color: '#fff',
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
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid var(--border-subtle)',
  },
  name: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#fff',
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
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: '7px 10px',
    color: '#fff',
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
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: '9px 14px',
    color: '#fff',
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
    color: '#fff',
    padding: '7px 8px',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  dash: {
    color: 'var(--text-dim)',
  },
  muted: {
    color: 'var(--text-dim)',
    fontSize: '0.86rem',
    padding: '24px',
    textAlign: 'center',
  },
  error: {
    margin: 0,
    color: '#f87171',
    fontSize: '0.82rem',
  },
};
