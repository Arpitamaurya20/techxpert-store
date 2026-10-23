import React, { useCallback, useEffect, useState } from 'react';
import { MapPin, PauseCircle, PlayCircle, Plus } from 'lucide-react';
import { api, type DeliveryPincode, type StoreTree } from '../services/api';
import {
  Badge,
  Button,
  Field,
  FormError,
  LoadState,
  NotGiven,
  PageIntro,
  Panel,
  StatGrid,
  useConfirm,
  useToast,
} from './ui';
import type { StatItem } from './ui';

interface DeliveryPincodeManagerProps {
  /** Delivery edit permission: add, pause or resume. */
  canManage: boolean;
  /** Stores view: lets the add form offer your stores. */
  canSeeStores: boolean;
  onAudit?: (action: string, details: string) => void;
  /** Goes up each time the header's Refresh is pressed; the screen reloads its own data. */
  refreshKey?: number;
}

const NO_STORE = '';

interface FormErrors {
  pincode?: string;
  area?: string;
  store?: string;
  form?: string;
}

export const DeliveryPincodeManager: React.FC<DeliveryPincodeManagerProps> = ({
  canManage,
  canSeeStores,
  onAudit,
  refreshKey = 0,
}) => {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [rows, setRows] = useState<DeliveryPincode[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pincode, setPincode] = useState('');
  const [areaName, setAreaName] = useState('');
  const [storeId, setStoreId] = useState(NO_STORE);
  const [tree, setTree] = useState<StoreTree | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [pincodes, storeTree] = await Promise.all([
        api.getDeliveryPincodes(),
        canManage && canSeeStores ? api.getStoreTree().catch(() => null) : Promise.resolve(null),
      ]);
      setRows(pincodes);
      setTree(storeTree);
      const active = storeTree?.stores.filter((s) => s.active) ?? [];
      setStoreId((current) => (current === NO_STORE && active.length === 1 ? String(active[0].id) : current));
    } catch (err: any) {
      setLoadError(err.message || 'The server did not answer.');
    } finally {
      setLoading(false);
    }
  }, [canManage, canSeeStores]);

  const activeStores = tree?.stores.filter((s) => s.active) ?? [];

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const activeCount = rows.filter((row) => row.active).length;
  /** Before the first successful load, a count is unknown rather than zero. */
  const unknown = rows.length === 0 && (loading || loadError != null);
  const stats: StatItem[] = [
    {
      label: 'Delivering to',
      value: unknown ? '—' : activeCount,
      icon: <MapPin size={20} />,
      iconColor: 'var(--success)',
    },
    {
      label: 'Paused',
      value: unknown ? '—' : rows.length - activeCount,
      icon: <PauseCircle size={20} />,
      iconColor: 'var(--warning)',
    },
  ];

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    const pin = pincode.trim();
    const area = areaName.trim();
    const found: FormErrors = {};
    if (!/^[1-9]\d{5}$/.test(pin)) found.pincode = 'Enter 6 digits that do not start with 0.';
    if (area.length < 2) found.area = 'Enter the area name customers will see, e.g. "Sector 62, Noida".';
    if (tree && !tree.wholeCompany && storeId === NO_STORE) found.store = 'Choose the store that delivers here.';
    setErrors(found);
    if (Object.keys(found).length) return;

    try {
      setSaving(true);
      const created = await api.addDeliveryPincode({
        pincode: pin,
        areaName: area,
        storeId: storeId === NO_STORE ? null : Number(storeId),
      });
      setRows((prev) => [...prev, created].sort((a, b) => a.pincode.localeCompare(b.pincode)));
      setPincode('');
      setAreaName('');
      onAudit?.(
        'Added delivery pincode',
        `Added delivery to ${created.pincode}${created.areaName ? ` (${created.areaName})` : ''}${
          created.storeName ? `, served by ${created.storeName}` : ', with no store yet'
        }`
      );
      toast.success(
        created.storeName
          ? `${created.storeName} now delivers to ${created.pincode}.`
          : `${created.pincode} added. Orders stay refused until a store serves it.`
      );
    } catch (err: any) {
      setErrors({ form: `Couldn't add ${pin}: ${err.message || 'the server refused it.'}` });
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (row: DeliveryPincode) => {
    if (row.active) {
      const ok = await confirm({
        title: `Pause delivery to ${row.pincode}?`,
        message: (
          <>
            New orders to <strong>{row.pincode}</strong>
            {row.areaName ? ` (${row.areaName})` : ''} will be refused at checkout until you resume it. Orders already
            placed are not affected, and nothing is deleted.
          </>
        ),
        confirmLabel: 'Pause delivery',
      });
      if (!ok) return;
    }
    try {
      setBusyId(row.id);
      const saved = await api.setDeliveryPincodeActive(row.id, !row.active);
      setRows((prev) => prev.map((r) => (r.id === row.id ? saved : r)));
      onAudit?.(
        saved.active ? 'Resumed delivery pincode' : 'Paused delivery pincode',
        `${saved.active ? 'Resumed' : 'Paused'} delivery to ${saved.pincode}${saved.areaName ? ` (${saved.areaName})` : ''}`
      );
      toast.success(saved.active ? `Delivery to ${saved.pincode} resumed.` : `Delivery to ${saved.pincode} paused.`);
    } catch (err: any) {
      toast.error(`Couldn't change ${row.pincode}: ${err.message}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <StatGrid items={stats} columns={2} />

      <PageIntro>
        The phone checks the delivery pincode at checkout, and the server refuses orders to pincodes that are not
        active here or not served by an active store. Pausing stops new orders to that pincode; nothing is deleted.
        {canManage ? '' : ' Your role can see pincodes but not add, pause or resume them.'}
      </PageIntro>

      {canManage ? (
        <Panel title="Add a pincode">
          <form onSubmit={add} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={styles.formRow}>
              <Field id="delivery-pincode" label="Pincode" error={errors.pincode} style={{ width: '160px' }}>
                <input
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="201309"
                  value={pincode}
                  onChange={(e) => {
                    setPincode(e.target.value.replace(/\D/g, '').slice(0, 6));
                    if (errors.pincode) setErrors((prev) => ({ ...prev, pincode: undefined }));
                  }}
                />
              </Field>
              <Field id="delivery-area" label="Area name" error={errors.area} style={{ flex: 1, minWidth: '220px' }}>
                <input
                  maxLength={120}
                  placeholder="Sector 62, Noida"
                  value={areaName}
                  onChange={(e) => {
                    setAreaName(e.target.value);
                    if (errors.area) setErrors((prev) => ({ ...prev, area: undefined }));
                  }}
                />
              </Field>
              {tree ? (
                <Field id="delivery-store" label="Served by" error={errors.store} style={{ width: '240px' }}>
                  <select
                    value={storeId}
                    onChange={(e) => {
                      setStoreId(e.target.value);
                      if (errors.store) setErrors((prev) => ({ ...prev, store: undefined }));
                    }}
                  >
                    {tree.wholeCompany ? <option value={NO_STORE}>No store yet (orders refused)</option> : null}
                    {!tree.wholeCompany && storeId === NO_STORE ? (
                      <option value={NO_STORE} disabled>
                        Choose a store
                      </option>
                    ) : null}
                    {activeStores.map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}
              <Button type="submit" icon={<Plus size={14} />} loading={saving} style={{ marginTop: '23px' }}>
                Add pincode
              </Button>
            </div>
            {errors.form ? <FormError>{errors.form}</FormError> : null}
          </form>
        </Panel>
      ) : null}

      <Panel title="Delivery pincodes">
        <LoadState
          loading={loading}
          error={loadError}
          what="delivery pincodes"
          onRetry={load}
          isEmpty={rows.length === 0}
          empty={{
            icon: <MapPin size={22} />,
            title: 'No delivery pincodes yet',
            description: canManage
              ? 'Every order is refused until a pincode is added. Add the first one above.'
              : 'Every order is refused until someone with delivery edit access adds a pincode.',
          }}
        >
          <div style={styles.list}>
            {rows.map((row) => (
              <div key={row.id} style={styles.row}>
                <span style={styles.pin}>{row.pincode}</span>
                <span style={styles.area}>{row.areaName || <NotGiven />}</span>
                <span style={styles.store}>{row.storeName ?? 'No store, orders refused'}</span>
                <Badge variant={row.active && row.storeName ? 'success' : 'warning'} size="sm">
                  {!row.active ? 'Paused' : row.storeName ? 'Delivering' : 'Not served'}
                </Badge>
                {canManage ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={row.active ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
                    loading={busyId === row.id}
                    onClick={() => toggle(row)}
                    aria-label={`${row.active ? 'Pause' : 'Resume'} delivery to ${row.pincode}`}
                  >
                    {row.active ? 'Pause' : 'Resume'}
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </LoadState>
      </Panel>
      {dialog}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  formRow: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
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
  pin: {
    fontFamily: 'monospace',
    fontSize: '0.92rem',
    fontWeight: 700,
    color: 'var(--text-main)',
    width: '80px',
  },
  area: {
    flex: 1,
    minWidth: 0,
    fontSize: '0.88rem',
    color: 'var(--text-muted)',
  },
  store: {
    width: '200px',
    fontSize: '0.82rem',
    color: 'var(--text-dim)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
};
