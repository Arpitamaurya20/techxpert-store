import React, { useCallback, useEffect, useState } from 'react';
import { MapPin, Pencil, Plus, RefreshCw, Settings2, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react';
import { api, type PortalRole, type ScopeNode, type StaffMember, type StoreTree } from '../services/api';
import { can, isWithin, type Level, type ModuleInfo, type Permissions } from '../services/access';
import { groupAndBelow } from '../services/storeTree';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  FormError,
  LoadState,
  Modal,
  PageIntro,
  Panel,
  StatGrid,
  useConfirm,
  useToast,
} from './ui';
import type { StatItem } from './ui';
import { AddStaffDialog, ManageStaffDialog, StaffBadges, TemporaryPasswordDialog } from './StaffAccounts';
import { lastSignIn } from '../services/format';

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
  const { confirm, dialog } = useConfirm();
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [roles, setRoles] = useState<PortalRole[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<RoleDraft | null>(null);
  const [draftError, setDraftError] = useState<{ name?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);
  const [busyStaffId, setBusyStaffId] = useState<number | null>(null);
  const [tree, setTree] = useState<StoreTree | null>(null);
  const [places, setPlaces] = useState<PlacesDraft | null>(null);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [managing, setManaging] = useState<StaffMember | null>(null);
  const [issued, setIssued] = useState<{ member: StaffMember; password: string; reset: boolean } | null>(null);
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
      setLoadError(err.message || 'The server did not answer.');
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
    setDraftError({});
    setDraft({ id: null, name: '', description: '', permissions: {} });
  };

  const openEdit = (role: PortalRole) => {
    setDraftError({});
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
    const found: { name?: string; form?: string } = {};
    if (name.length < 2) found.name = 'Give the role a name of at least 2 characters.';
    if (!modules.some((m) => draft.permissions[m.key]?.view)) found.form = 'Tick View on at least one module.';
    setDraftError(found);
    if (found.name || found.form) return;
    try {
      setSaving(true);
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
      setDraftError({ form: `Couldn't save the role: ${err.message || 'the server refused it.'}` });
    } finally {
      setSaving(false);
    }
  };

  const removeRole = async (role: PortalRole) => {
    const ok = await confirm({
      title: `Delete the role "${role.name}"?`,
      message: 'Nobody holds this role, so no one loses access. The role and its module ticks are removed for good.',
      confirmLabel: 'Delete role',
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.deleteAccessRole(role.id);
      toast.success(`Role "${role.name}" deleted.`);
      await load();
    } catch (err: any) {
      toast.error(`Couldn't delete "${role.name}": ${err.message || 'the server refused it.'}`);
    }
  };

  const assign = async (member: StaffMember, value: string) => {
    const roleId = value === '' ? null : Number(value);
    if (roleId == null && member.roleId != null) {
      const ok = await confirm({
        title: `Remove ${member.name}'s portal access?`,
        message: (
          <>
            {member.name} loses the role <strong>{member.roleName ?? 'they have'}</strong> and sees no portal modules
            from their next action. Their login stays; give them a role again any time.
          </>
        ),
        confirmLabel: 'Remove access',
        destructive: true,
      });
      if (!ok) return;
    }
    try {
      setBusyStaffId(member.id);
      const saved = await api.assignStaffRole(member.id, roleId);
      setStaff((prev) => prev.map((s) => (s.id === member.id ? saved : s)));
      toast.success(roleId == null ? `${member.name} no longer has portal access.` : `${member.name} now has "${saved.roleName}".`);
      const roleData = await api.getAccessRoles();
      setRoles(roleData.roles);
    } catch (err: any) {
      toast.error(`Couldn't change ${member.name}'s role: ${err.message || 'the server refused it.'}`);
    } finally {
      setBusyStaffId(null);
    }
  };

  const replaceMember = (saved: StaffMember) => setStaff((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));

  const added = async (member: StaffMember, temporaryPassword?: string) => {
    setAdding(false);
    if (temporaryPassword) setIssued({ member, password: temporaryPassword, reset: false });
    toast.success(
      member.kind === 'linked'
        ? `${member.name} is linked. Give them a role so they can use the portal.`
        : `Store login created for ${member.name}. Give them a role so they can use the portal.`
    );
    await load();
  };

  const resetPassword = async (member: StaffMember) => {
    setManaging(null);
    const ok = await confirm({
      title: `Reset ${member.name}'s password?`,
      message: `${member.name} is signed out everywhere and can only sign in with the new temporary password, which you'll see once.`,
      confirmLabel: 'Reset password',
      destructive: true,
    });
    if (!ok) return;
    try {
      const result = await api.resetStaffPassword(member.id);
      replaceMember({ ...member, mustChangePassword: true });
      setIssued({ member, password: result.temporaryPassword, reset: true });
    } catch (err: any) {
      toast.error(`Couldn't reset ${member.name}'s password: ${err.message || 'the server refused it.'}`);
    }
  };

  const setActive = async (member: StaffMember, active: boolean) => {
    setManaging(null);
    if (!active) {
      const ok = await confirm({
        title: `Switch off ${member.name}?`,
        message:
          member.kind === 'linked'
            ? `${member.name} can't use the store portal from their next click. Their Homecare login is not affected. Their role and places are kept in case you switch them back on.`
            : `${member.name} can't sign in or use the portal from their next click. Their role and places are kept in case you switch them back on.`,
        confirmLabel: 'Switch off',
        destructive: true,
      });
      if (!ok) return;
    }
    try {
      replaceMember(await api.updateStaff(member.id, { active }));
      toast.success(active ? `${member.name} can use the portal again.` : `${member.name} is switched off.`);
    } catch (err: any) {
      toast.error(`Couldn't change ${member.name}: ${err.message || 'the server refused it.'}`);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PageIntro
        actions={
          <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={load} disabled={loading}>
            Refresh
          </Button>
        }
      >
        Only people on this staff list can sign in. A role decides which portal modules they see and whether they can
        edit or delete there; super admin always has everything. You can only give out access you have yourself, and
        you can't change your own role.
      </PageIntro>

      <LoadState
        loading={loading}
        error={loadError}
        what="roles and staff"
        onRetry={load}
        isEmpty={roles.length === 0 && staff.length === 0}
        empty={{
          icon: <Users size={22} />,
          title: 'No roles or staff yet',
          description: 'Create a role, then add staff and give them that role.',
        }}
      >
        <StatGrid items={stats} columns={2} />

        <Panel
          title="Roles"
          actions={
            canEdit ? (
              <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={openNew}>
                New role
              </Button>
            ) : null
          }
        >
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
                      variant="danger"
                      size="sm"
                      icon={<Trash2 size={13} />}
                      disabled={role.staffCount > 0}
                      title={role.staffCount > 0 ? 'Move everyone off this role before deleting it' : undefined}
                      aria-label={`Delete role ${role.name}`}
                      onClick={() => removeRole(role)}
                    >
                      Delete
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Staff"
          actions={
            canEdit ? (
              <Button variant="primary" size="sm" icon={<UserPlus size={14} />} onClick={() => setAdding(true)}>
                Add staff
              </Button>
            ) : null
          }
        >
          <p style={styles.hint}>
            A store login is for someone who works only in the store. Someone who also works in Homecare is linked
            instead, and signs in with their Homecare email and password.
          </p>
          {staff.length === 0 ? (
            <EmptyState
              icon={<Users size={22} />}
              title="No staff yet"
              description="Add a store login, or link someone's Homecare login, then give them a role."
            />
          ) : null}
          <div style={styles.list}>
            {staff.map((member) => (
              <div key={member.id} style={{ ...styles.row, opacity: member.active ? 1 : 0.55 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.name}>
                    {member.name}
                    <StaffBadges member={member} />
                  </div>
                  <div style={styles.meta}>
                    {member.email} · {lastSignIn(member.lastLoginAt)}
                  </div>
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
                    className="tx-input"
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
                {member.changeable && (canEdit || canDelete) ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Settings2 size={13} />}
                    onClick={() => setManaging(member)}
                    aria-label={`Manage ${member.name}`}
                  >
                    Manage
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </Panel>
      </LoadState>

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
            <Field id="role-name" label="Name" error={draftError.name}>
              <input
                maxLength={80}
                placeholder="Store manager"
                value={draft.name}
                onChange={(e) => {
                  setDraft({ ...draft, name: e.target.value });
                  if (draftError.name) setDraftError((prev) => ({ ...prev, name: undefined }));
                }}
              />
            </Field>
            <Field id="role-description" label="What this role is for (optional)">
              <input
                maxLength={255}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </Field>
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
            {draftError.form ? <FormError>{draftError.form}</FormError> : null}
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
                <div role="status" style={styles.muted}>
                  Loading your groups and stores…
                </div>
              )
            ) : null}
            {!places.all && places.picked.size === 0 && tree ? (
              <p style={styles.hint}>With nothing ticked, this person sees no orders, pincodes or customers.</p>
            ) : null}
            {placesError ? <FormError>{placesError}</FormError> : null}
          </div>
        ) : null}
      </Modal>
      {adding ? <AddStaffDialog onClose={() => setAdding(false)} onAdded={added} /> : null}
      {managing ? (
        <ManageStaffDialog
          key={managing.id}
          member={managing}
          canEdit={canEdit}
          canDelete={canDelete}
          onClose={() => setManaging(null)}
          onRenamed={(saved) => {
            replaceMember(saved);
            setManaging(saved);
          }}
          onResetPassword={resetPassword}
          onSetActive={setActive}
        />
      ) : null}
      <TemporaryPasswordDialog issued={issued} onClose={() => setIssued(null)} />
      {dialog}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  hint: {
    margin: 0,
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
    maxWidth: '720px',
    lineHeight: 1.45,
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
    width: 'auto',
    minWidth: '200px',
    padding: '7px 10px',
    fontSize: '0.84rem',
  },
  fixedRole: {
    fontSize: '0.84rem',
    color: 'var(--text-muted)',
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
};
