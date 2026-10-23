import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FolderPlus, MapPin, Network, Pencil, Plus, Power, RefreshCw, Store, Trash2, Unlink } from 'lucide-react';
import { api, type StoreGroup, type StorePincodeLink, type StoreSummary, type StoreTree } from '../services/api';
import { groupAndBelow, groupPath } from '../services/storeTree';
import { Badge, Button, EmptyState, Modal, StatGrid, useToast } from './ui';
import type { StatItem } from './ui';

interface StoreTreeManagerProps {
  /** Stores edit: add, rename and move groups and stores; link pincodes. */
  canEdit: boolean;
  /** Stores delete: delete empty groups, deactivate stores. */
  canDelete: boolean;
}

type GroupDraft = { id: number | null; name: string; kind: string; parentId: number | null };
type StoreDraft = {
  id: number | null;
  name: string;
  groupId: number | null;
  pincode: string;
  contactNumber: string;
  email: string;
  address: string;
};

const TOP = '';

export const StoreTreeManager: React.FC<StoreTreeManagerProps> = ({ canEdit, canDelete }) => {
  const toast = useToast();
  const [tree, setTree] = useState<StoreTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [links, setLinks] = useState<StorePincodeLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [groupDraft, setGroupDraft] = useState<GroupDraft | null>(null);
  const [storeDraft, setStoreDraft] = useState<StoreDraft | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      setTree(await api.getStoreTree());
    } catch (err: any) {
      setLoadError(err.message || 'Could not load stores and groups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadLinks = useCallback(async (storeId: number) => {
    try {
      setLinksLoading(true);
      setLinkError(null);
      setLinks(await api.getStorePincodes(storeId));
    } catch (err: any) {
      setLinkError(err.message || 'Could not load this store’s pincodes');
    } finally {
      setLinksLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedStoreId != null) loadLinks(selectedStoreId);
  }, [selectedStoreId, loadLinks]);

  const groups = useMemo(() => tree?.groups ?? [], [tree]);
  const stores = useMemo(() => tree?.stores ?? [], [tree]);
  const wholeCompany = tree?.wholeCompany ?? false;
  const visibleGroupIds = useMemo(() => new Set(groups.map((g) => g.id)), [groups]);
  const selectedStore = stores.find((s) => s.id === selectedStoreId) ?? null;

  const childGroups = (parentId: number | null) =>
    groups.filter((g) =>
      parentId == null ? g.parentId == null || !visibleGroupIds.has(g.parentId) : g.parentId === parentId
    );
  const storesIn = (groupId: number | null) =>
    stores.filter((s) =>
      groupId == null ? s.groupId == null || !visibleGroupIds.has(s.groupId) : s.groupId === groupId
    );

  const stats: StatItem[] = [
    { label: 'Stores', value: stores.filter((s) => s.active).length, icon: <Store size={20} />, iconColor: 'var(--success)' },
    { label: 'Groups', value: groups.length, icon: <Network size={20} />, iconColor: 'var(--accent)' },
    {
      label: 'Pincodes served',
      value: stores.reduce((sum, s) => sum + s.pincodeCount, 0),
      icon: <MapPin size={20} />,
      iconColor: 'var(--accent)',
    },
  ];

  /** Where something may be placed: your groups, plus the top level for whole-company staff. */
  const placeOptions = (excludeUnder?: number) => {
    const blocked = excludeUnder != null ? groupAndBelow(excludeUnder, groups) : new Set<number>();
    return groups
      .filter((g) => !blocked.has(g.id))
      .map((g) => ({ id: g.id, label: groupPath(g.id, groups) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  };

  const run = async (work: () => Promise<void>, failure: string) => {
    try {
      setSaving(true);
      setDraftError(null);
      await work();
    } catch (err: any) {
      setDraftError(err.message || failure);
    } finally {
      setSaving(false);
    }
  };

  const saveGroup = () =>
    groupDraft &&
    run(async () => {
      const body = { name: groupDraft.name.trim(), kind: groupDraft.kind.trim(), parentId: groupDraft.parentId };
      if (body.name.length < 2) throw new Error('Give the group a name of at least 2 characters.');
      if (groupDraft.id == null) {
        await api.createStoreGroup(body);
        toast.success(`Group "${body.name}" created.`);
      } else {
        await api.updateStoreGroup(groupDraft.id, body);
        toast.success(`Group "${body.name}" saved.`);
      }
      setGroupDraft(null);
      await load();
    }, 'Could not save this group');

  const saveStore = () =>
    storeDraft &&
    run(async () => {
      const name = storeDraft.name.trim();
      if (name.length < 2) throw new Error('Give the store a name of at least 2 characters.');
      const details = {
        name,
        groupId: storeDraft.groupId,
        contactNumber: storeDraft.contactNumber.trim(),
        email: storeDraft.email.trim(),
        address: storeDraft.address.trim(),
      };
      if (storeDraft.id == null) {
        if (!/^[1-9]\d{5}$/.test(storeDraft.pincode)) throw new Error("Enter the store's own 6-digit pincode.");
        const created = await api.createStore({ ...details, pincode: storeDraft.pincode });
        toast.success(`Store "${created.name}" (${created.code}) created. Link the pincodes it serves on the right.`);
        setSelectedStoreId(created.id);
      } else {
        await api.updateStore(storeDraft.id, details);
        toast.success(`Store "${name}" saved.`);
      }
      setStoreDraft(null);
      await load();
    }, 'Could not save this store');

  const deleteGroup = async (group: StoreGroup) => {
    if (!window.confirm(`Delete the group "${group.name}"?`)) return;
    try {
      await api.deleteStoreGroup(group.id);
      toast.success(`Group "${group.name}" deleted.`);
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Could not delete this group');
    }
  };

  const setStoreActive = async (store: StoreSummary, active: boolean) => {
    if (!active && !window.confirm(`Deactivate "${store.name}"? It must not serve any pincode.`)) return;
    try {
      await api.updateStore(store.id, { active });
      toast.success(active ? `"${store.name}" reactivated.` : `"${store.name}" deactivated.`);
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Could not change this store');
    }
  };

  const link = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedStore) return;
    const pin = linkInput.trim();
    if (!/^[1-9]\d{5}$/.test(pin)) {
      setLinkError('Enter a 6-digit pincode that does not start with 0.');
      return;
    }
    try {
      setLinkError(null);
      setLinks(await api.linkStorePincode(selectedStore.id, pin));
      setLinkInput('');
      toast.success(`${selectedStore.name} now serves ${pin}.`);
      await load();
    } catch (err: any) {
      setLinkError(err.message || 'Could not link this pincode');
    }
  };

  const unlink = async (row: StorePincodeLink) => {
    if (!selectedStore) return;
    if (!window.confirm(`Stop ${selectedStore.name} serving ${row.pincode}? Orders to it are refused until another store takes it.`)) {
      return;
    }
    try {
      setLinks(await api.unlinkStorePincode(selectedStore.id, row.pincodeId));
      toast.success(`${row.pincode} is no longer served by ${selectedStore.name}.`);
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Could not unlink this pincode');
    }
  };

  const openNewStore = (groupId: number | null) => {
    setDraftError(null);
    setStoreDraft({ id: null, name: '', groupId, pincode: '', contactNumber: '', email: '', address: '' });
  };

  const renderStore = (store: StoreSummary, depth: number) => (
    <div
      key={`s${store.id}`}
      role="button"
      tabIndex={0}
      aria-pressed={store.id === selectedStoreId}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setSelectedStoreId(store.id);
        }
      }}
      style={{
        ...styles.row,
        marginLeft: depth * 20,
        cursor: 'pointer',
        opacity: store.active ? 1 : 0.55,
        borderColor: store.id === selectedStoreId ? 'var(--accent)' : 'var(--border-subtle)',
      }}
      onClick={() => setSelectedStoreId(store.id)}
    >
      <Store size={15} color="var(--success)" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={styles.name}>
          {store.name}
          {!store.active ? (
            <Badge variant="neutral" size="sm">
              Inactive
            </Badge>
          ) : null}
        </div>
        <div style={styles.meta}>
          {store.code} · {store.pincodeCount} {store.pincodeCount === 1 ? 'pincode' : 'pincodes'}
        </div>
      </div>
    </div>
  );

  const renderGroup = (group: StoreGroup, depth: number): React.ReactNode => (
    <React.Fragment key={`g${group.id}`}>
      <div style={{ ...styles.row, marginLeft: depth * 20 }}>
        <Network size={15} color="var(--accent)" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.name}>
            {group.name}
            {group.kind ? (
              <Badge variant="neutral" size="sm">
                {group.kind}
              </Badge>
            ) : null}
          </div>
        </div>
        {canEdit ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              icon={<FolderPlus size={13} />}
              title="Add a group inside"
              onClick={() => {
                setDraftError(null);
                setGroupDraft({ id: null, name: '', kind: '', parentId: group.id });
              }}
            />
            <Button variant="ghost" size="sm" icon={<Plus size={13} />} title="Add a store here" onClick={() => openNewStore(group.id)} />
            <Button
              variant="ghost"
              size="sm"
              icon={<Pencil size={13} />}
              title="Rename or move"
              onClick={() => {
                setDraftError(null);
                setGroupDraft({ id: group.id, name: group.name, kind: group.kind, parentId: group.parentId });
              }}
            />
          </>
        ) : null}
        {canDelete ? (
          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2 size={13} color="var(--danger)" />}
            title="Delete (only when empty)"
            onClick={() => deleteGroup(group)}
          />
        ) : null}
      </div>
      {childGroups(group.id).map((child) => renderGroup(child, depth + 1))}
      {storesIn(group.id).map((store) => renderStore(store, depth + 1))}
    </React.Fragment>
  );

  if (loading && !tree) return <div style={styles.muted}>Loading stores and groups…</div>;
  if (loadError) return <div style={{ ...styles.panel, ...styles.error }}>{loadError}</div>;

  const editingGroupId = groupDraft?.id ?? undefined;
  const groupPlaces = placeOptions(editingGroupId);
  const storePlaces = placeOptions();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <StatGrid items={stats} columns={3} />

      <div style={styles.toolbar}>
        <p style={styles.hint}>
          Each delivery pincode is served by one store, and each order is tagged with that store at checkout. Groups
          (zones, areas, clusters…) sit above stores; staff given a group in Roles &amp; Access see every store under
          it. {wholeCompany ? 'You see the whole company.' : 'You see only the places you were given.'}
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          {canEdit && wholeCompany ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                icon={<FolderPlus size={14} />}
                onClick={() => {
                  setDraftError(null);
                  setGroupDraft({ id: null, name: '', kind: '', parentId: null });
                }}
              >
                New group
              </Button>
              <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => openNewStore(null)}>
                New store
              </Button>
            </>
          ) : null}
          <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={load} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      <div style={styles.columns}>
        <div style={{ ...styles.panel, flex: '1 1 420px' }}>
          <h3 style={styles.panelTitle}>{wholeCompany ? 'Company tree' : 'Your places'}</h3>
          {groups.length === 0 && stores.length === 0 ? (
            <EmptyState
              icon={<Network size={22} />}
              title="Nothing in your places yet"
              description={wholeCompany ? 'Add a group or a store to start.' : 'Ask a store admin to give you a group or store.'}
            />
          ) : (
            <div style={styles.list}>
              {childGroups(null).map((group) => renderGroup(group, 0))}
              {storesIn(null).map((store) => renderStore(store, 0))}
            </div>
          )}
        </div>

        <div style={{ ...styles.panel, flex: '1 1 360px' }}>
          {!selectedStore ? (
            <EmptyState icon={<Store size={22} />} title="Pick a store" description="Its details and the pincodes it serves show here." />
          ) : (
            <>
              <div style={styles.panelHeader}>
                <div>
                  <h3 style={styles.panelTitle}>{selectedStore.name}</h3>
                  <div style={styles.meta}>
                    {selectedStore.code}
                    {selectedStore.groupId != null && visibleGroupIds.has(selectedStore.groupId)
                      ? ` · ${groupPath(selectedStore.groupId, groups)}`
                      : selectedStore.groupId == null
                        ? ' · top level'
                        : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {canEdit ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Pencil size={13} />}
                      onClick={() => {
                        setDraftError(null);
                        setStoreDraft({
                          id: selectedStore.id,
                          name: selectedStore.name,
                          groupId: selectedStore.groupId,
                          pincode: '',
                          contactNumber: selectedStore.contactNumber,
                          email: selectedStore.email,
                          address: selectedStore.address,
                        });
                      }}
                    >
                      Edit
                    </Button>
                  ) : null}
                  {selectedStore.active && canDelete ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Power size={13} color="var(--danger)" />}
                      title="Deactivate"
                      onClick={() => setStoreActive(selectedStore, false)}
                    />
                  ) : null}
                  {!selectedStore.active && canEdit ? (
                    <Button variant="ghost" size="sm" icon={<Power size={13} />} onClick={() => setStoreActive(selectedStore, true)}>
                      Reactivate
                    </Button>
                  ) : null}
                </div>
              </div>
              {selectedStore.address || selectedStore.contactNumber || selectedStore.email ? (
                <div style={styles.meta}>
                  {[selectedStore.address, selectedStore.contactNumber, selectedStore.email].filter(Boolean).join(' · ')}
                </div>
              ) : null}

              <h4 style={styles.subTitle}>Pincodes served</h4>
              {canEdit && selectedStore.active ? (
                <form style={styles.formRow} onSubmit={link}>
                  <input
                    style={{ ...styles.input, width: '140px' }}
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="201309"
                    aria-label="Pincode to serve"
                    value={linkInput}
                    onChange={(e) => setLinkInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                  <Button type="submit" size="sm" icon={<Plus size={13} />}>
                    Serve this pincode
                  </Button>
                </form>
              ) : null}
              {linkError ? <p style={styles.error}>{linkError}</p> : null}
              {linksLoading ? (
                <div style={styles.muted}>Loading pincodes…</div>
              ) : links.length === 0 ? (
                <p style={styles.hint}>This store serves no pincodes yet. Orders are only accepted for pincodes a store serves.</p>
              ) : (
                <div style={styles.list}>
                  {links.map((row) => (
                    <div key={row.linkId} style={{ ...styles.row, opacity: row.active ? 1 : 0.5 }}>
                      <span style={styles.pin}>{row.pincode}</span>
                      <span style={{ ...styles.meta, flex: 1, marginTop: 0 }}>{row.areaName || '—'}</span>
                      {row.active ? (
                        <Badge variant={row.deliveryActive ? 'success' : 'warning'} size="sm">
                          {row.deliveryActive ? 'Serving' : 'Paused'}
                        </Badge>
                      ) : (
                        <Badge variant="neutral" size="sm">
                          Earlier
                        </Badge>
                      )}
                      {row.active && canEdit ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Unlink size={13} />}
                          title="Stop serving this pincode"
                          onClick={() => unlink(row)}
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Modal
        isOpen={groupDraft != null}
        onClose={() => setGroupDraft(null)}
        title={groupDraft?.id == null ? 'New group' : `Edit "${groups.find((g) => g.id === groupDraft?.id)?.name ?? 'group'}"`}
        subtitle="Groups can be nested up to 8 levels. Moving a group moves everything inside it."
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setGroupDraft(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" loading={saving} onClick={saveGroup}>
              {groupDraft?.id == null ? 'Create group' : 'Save group'}
            </Button>
          </>
        }
      >
        {groupDraft ? (
          <div style={styles.form}>
            <label style={styles.label} htmlFor="group-name">
              Name
            </label>
            <input
              id="group-name"
              style={styles.input}
              maxLength={80}
              placeholder="North Zone"
              value={groupDraft.name}
              onChange={(e) => setGroupDraft({ ...groupDraft, name: e.target.value })}
            />
            <label style={styles.label} htmlFor="group-kind">
              Kind (optional)
            </label>
            <input
              id="group-kind"
              style={styles.input}
              maxLength={40}
              placeholder="Zone, Area, Cluster…"
              value={groupDraft.kind}
              onChange={(e) => setGroupDraft({ ...groupDraft, kind: e.target.value })}
            />
            <label style={styles.label} htmlFor="group-parent">
              Inside
            </label>
            <select
              id="group-parent"
              style={styles.input}
              value={groupDraft.parentId == null ? TOP : String(groupDraft.parentId)}
              onChange={(e) => setGroupDraft({ ...groupDraft, parentId: e.target.value === TOP ? null : Number(e.target.value) })}
            >
              {wholeCompany || groupDraft.parentId == null ? (
                <option value={TOP} disabled={!wholeCompany}>
                  Top level
                </option>
              ) : null}
              {groupPlaces.map((g) => (
                <option key={g.id} value={String(g.id)}>
                  {g.label}
                </option>
              ))}
            </select>
            {draftError ? <p style={styles.error}>{draftError}</p> : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={storeDraft != null}
        onClose={() => setStoreDraft(null)}
        title={storeDraft?.id == null ? 'New store' : `Edit "${stores.find((s) => s.id === storeDraft?.id)?.name ?? 'store'}"`}
        subtitle={
          storeDraft?.id == null
            ? 'The store code is generated. Its own pincode must already be under Delivery Pincodes.'
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setStoreDraft(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" loading={saving} onClick={saveStore}>
              {storeDraft?.id == null ? 'Create store' : 'Save store'}
            </Button>
          </>
        }
      >
        {storeDraft ? (
          <div style={styles.form}>
            <label style={styles.label} htmlFor="store-name">
              Name
            </label>
            <input
              id="store-name"
              style={styles.input}
              maxLength={255}
              placeholder="Sector 62 Store"
              value={storeDraft.name}
              onChange={(e) => setStoreDraft({ ...storeDraft, name: e.target.value })}
            />
            <label style={styles.label} htmlFor="store-group">
              Group
            </label>
            <select
              id="store-group"
              style={styles.input}
              value={storeDraft.groupId == null ? TOP : String(storeDraft.groupId)}
              onChange={(e) => setStoreDraft({ ...storeDraft, groupId: e.target.value === TOP ? null : Number(e.target.value) })}
            >
              {wholeCompany || storeDraft.groupId == null ? (
                <option value={TOP} disabled={!wholeCompany}>
                  Top level (no group)
                </option>
              ) : null}
              {storePlaces.map((g) => (
                <option key={g.id} value={String(g.id)}>
                  {g.label}
                </option>
              ))}
            </select>
            {storeDraft.id == null ? (
              <>
                <label style={styles.label} htmlFor="store-pincode">
                  The store’s own pincode
                </label>
                <input
                  id="store-pincode"
                  style={styles.input}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="201309"
                  value={storeDraft.pincode}
                  onChange={(e) => setStoreDraft({ ...storeDraft, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                />
              </>
            ) : null}
            <label style={styles.label} htmlFor="store-address">
              Address (optional)
            </label>
            <input
              id="store-address"
              style={styles.input}
              maxLength={1000}
              value={storeDraft.address}
              onChange={(e) => setStoreDraft({ ...storeDraft, address: e.target.value })}
            />
            <div style={styles.formRow}>
              <div style={{ flex: 1 }}>
                <label style={styles.label} htmlFor="store-phone">
                  Contact number (optional)
                </label>
                <input
                  id="store-phone"
                  style={styles.input}
                  maxLength={20}
                  value={storeDraft.contactNumber}
                  onChange={(e) => setStoreDraft({ ...storeDraft, contactNumber: e.target.value })}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={styles.label} htmlFor="store-email">
                  Email (optional)
                </label>
                <input
                  id="store-email"
                  style={styles.input}
                  maxLength={255}
                  value={storeDraft.email}
                  onChange={(e) => setStoreDraft({ ...storeDraft, email: e.target.value })}
                />
              </div>
            </div>
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
  columns: {
    display: 'flex',
    gap: '20px',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  panel: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    minWidth: 0,
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
  },
  panelTitle: {
    margin: 0,
    fontSize: '0.98rem',
    fontWeight: 700,
    color: 'var(--text-main)',
  },
  subTitle: {
    margin: '6px 0 0',
    fontSize: '0.84rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '9px 12px',
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
  meta: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
  pin: {
    fontFamily: 'monospace',
    fontSize: '0.9rem',
    fontWeight: 700,
    color: 'var(--text-main)',
    width: '70px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  formRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
  },
  label: {
    display: 'block',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginTop: '6px',
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
