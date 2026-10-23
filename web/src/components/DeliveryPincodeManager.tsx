import React, { useCallback, useEffect, useState } from 'react';
import { MapPin, PauseCircle, PlayCircle, Plus, RefreshCw } from 'lucide-react';
import { api, type DeliveryPincode } from '../services/api';
import { Badge, Button, EmptyState, StatGrid } from './ui';
import type { StatItem } from './ui';

interface DeliveryPincodeManagerProps {
  /** Delivery edit permission: add, pause or resume. */
  canManage: boolean;
  onAudit?: (action: string, details: string) => void;
  onToast?: (message: string) => void;
}

export const DeliveryPincodeManager: React.FC<DeliveryPincodeManagerProps> = ({ canManage, onAudit, onToast }) => {
  const [rows, setRows] = useState<DeliveryPincode[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pincode, setPincode] = useState('');
  const [areaName, setAreaName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      setRows(await api.getDeliveryPincodes());
    } catch (err: any) {
      setLoadError(err.message || 'Could not load delivery pincodes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeCount = rows.filter((row) => row.active).length;
  const stats: StatItem[] = [
    { label: 'Delivering to', value: activeCount, icon: <MapPin size={20} />, iconColor: '#10b981' },
    { label: 'Paused', value: rows.length - activeCount, icon: <PauseCircle size={20} />, iconColor: '#f59e0b' },
  ];

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    const pin = pincode.trim();
    const area = areaName.trim();
    if (!/^[1-9]\d{5}$/.test(pin)) {
      setFormError('Enter a 6-digit pincode that does not start with 0.');
      return;
    }
    if (area.length < 2) {
      setFormError('Enter the area name customers will see, e.g. "Sector 62, Noida".');
      return;
    }
    try {
      setSaving(true);
      setFormError(null);
      const created = await api.addDeliveryPincode({ pincode: pin, areaName: area });
      setRows((prev) => [...prev, created].sort((a, b) => a.pincode.localeCompare(b.pincode)));
      setPincode('');
      setAreaName('');
      onAudit?.('Added Delivery Pincode', `${created.pincode} (${created.areaName})`);
      onToast?.(`Now delivering to ${created.pincode}.`);
    } catch (err: any) {
      setFormError(err.message || 'Could not add this pincode');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (row: DeliveryPincode) => {
    try {
      setBusyId(row.id);
      const saved = await api.setDeliveryPincodeActive(row.id, !row.active);
      setRows((prev) => prev.map((r) => (r.id === row.id ? saved : r)));
      onAudit?.(saved.active ? 'Resumed Delivery Pincode' : 'Paused Delivery Pincode', `${saved.pincode} (${saved.areaName})`);
      onToast?.(saved.active ? `Delivery to ${saved.pincode} resumed.` : `Delivery to ${saved.pincode} paused.`);
    } catch (err: any) {
      onToast?.(`Failed to update ${row.pincode}: ${err.message}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <StatGrid items={stats} columns={2} />

      <div style={styles.toolbar}>
        <p style={styles.hint}>
          The phone checks the delivery pincode at checkout, and the server refuses orders to pincodes that are not
          active here. Pausing stops new orders to that pincode; nothing is deleted.
          {canManage ? '' : ' Your role can see pincodes but not add, pause or resume them.'}
        </p>
        <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={load} disabled={loading}>
          Refresh
        </Button>
      </div>

      {canManage ? (
        <form style={styles.panel} onSubmit={add}>
          <div style={styles.formRow}>
            <div style={{ width: '160px' }}>
              <label style={styles.label} htmlFor="delivery-pincode">
                Pincode
              </label>
              <input
                id="delivery-pincode"
                style={styles.input}
                inputMode="numeric"
                maxLength={6}
                placeholder="201309"
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <label style={styles.label} htmlFor="delivery-area">
                Area name
              </label>
              <input
                id="delivery-area"
                style={styles.input}
                maxLength={120}
                placeholder="Sector 62, Noida"
                value={areaName}
                onChange={(e) => setAreaName(e.target.value)}
              />
            </div>
            <Button type="submit" icon={<Plus size={14} />} loading={saving} style={{ alignSelf: 'flex-end' }}>
              Add pincode
            </Button>
          </div>
          {formError ? <p style={styles.error}>{formError}</p> : null}
        </form>
      ) : null}

      <div style={styles.panel}>
        {loading ? (
          <div style={styles.muted}>Loading delivery pincodes…</div>
        ) : loadError ? (
          <div style={styles.error}>{loadError}</div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<MapPin size={22} />}
            title="No delivery pincodes"
            description="Until a pincode is added, every order is refused."
          />
        ) : (
          <div style={styles.list}>
            {rows.map((row) => (
              <div key={row.id} style={styles.row}>
                <span style={styles.pin}>{row.pincode}</span>
                <span style={styles.area}>{row.areaName || '—'}</span>
                <Badge variant={row.active ? 'success' : 'warning'} size="sm">
                  {row.active ? 'Delivering' : 'Paused'}
                </Badge>
                {canManage ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={row.active ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
                    loading={busyId === row.id}
                    onClick={() => toggle(row)}
                  >
                    {row.active ? 'Pause' : 'Resume'}
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
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
  formRow: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
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
  pin: {
    fontFamily: 'monospace',
    fontSize: '0.92rem',
    fontWeight: 700,
    color: '#fff',
    width: '80px',
  },
  area: {
    flex: 1,
    minWidth: 0,
    fontSize: '0.88rem',
    color: 'var(--text-muted)',
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
