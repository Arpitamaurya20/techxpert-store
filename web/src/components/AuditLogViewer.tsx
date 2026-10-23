import React, { useMemo, useState } from 'react';
import { History } from 'lucide-react';
import type { AuditLog } from '../types';
import { formatDay } from '../services/format';
import { Badge, LoadState, PageIntro } from './ui';

interface AuditLogViewerProps {
  logs: AuditLog[];
  /** How many of the newest changes were asked for. */
  limit: number;
  loading: boolean;
  loadError: string | null;
  loaded: boolean;
  onRetry: () => void;
}

const AREA: Record<AuditLog['entity'], string> = {
  product: 'Products',
  category: 'Categories',
  order: 'Orders',
  delivery: 'Delivery',
  store: 'Stores',
  bulk_tier: 'Bulk prices',
  banner: 'Banners',
  section: 'Home screen',
  publish: 'Publishing',
  access: 'Staff & access',
};

const areaOf = (entity: string) => AREA[entity as AuditLog['entity']] ?? 'Other';

/** The sentence staff read. Older section entries were saved as "Quick tools set to hidden". */
function sentence(log: AuditLog): string {
  const details = (log.details || '').trim();
  if (log.entity === 'section') {
    const old = /^(.+) set to (hidden|visible)$/.exec(details);
    if (old) return `${old[2] === 'hidden' ? 'Hid' : 'Showed'} "${old[1]}" on the app home screen`;
  }
  if (details) return details;
  const action = (log.action || '').trim();
  return action ? action.charAt(0) + action.slice(1).toLowerCase() : 'Change with no description';
}

/** Saved as "Name (Role)"; the role is left out when there was none. */
function who(actor: string): { name: string; role: string | null } {
  const m = /^(.*) \(([^()]*)\)$/.exec((actor || '').trim());
  if (!m) return { name: actor?.trim() || 'Someone', role: null };
  return { name: m[1], role: m[2] && m[2] !== 'no role' ? m[2] : null };
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

const timeOf = (d: Date) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ logs, limit, loading, loadError, loaded, onRetry }) => {
  const [area, setArea] = useState('');
  const [today] = useState(() => new Date());

  const areas = useMemo(() => Array.from(new Set(logs.map((l) => areaOf(l.entity)))).sort(), [logs]);
  const shown = area && areas.includes(area) ? logs.filter((l) => areaOf(l.entity) === area) : logs;

  const days = useMemo(() => {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const groups: { key: string; label: string; entries: { log: AuditLog; at: Date | null }[] }[] = [];
    for (const log of shown) {
      const at = log.timestamp ? new Date(log.timestamp) : null;
      const valid = at && !Number.isNaN(at.getTime()) ? at : null;
      const key = valid ? dayKey(valid) : 'unknown';
      const label = !valid
        ? 'Date not recorded'
        : key === dayKey(today)
          ? 'Today'
          : key === dayKey(yesterday)
            ? 'Yesterday'
            : (formatDay(valid) ?? 'Date not recorded');
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.entries.push({ log, at: valid });
      else groups.push({ key, label, entries: [{ log, at: valid }] });
    }
    return groups;
  }, [shown, today]);

  return (
    <div style={styles.container}>
      <PageIntro
        actions={
          areas.length > 1 ? (
            <select
              aria-label="Show changes in"
              className="tx-input"
              style={styles.filter}
              value={area}
              onChange={(e) => setArea(e.target.value)}
            >
              <option value="">All areas</option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          ) : null
        }
      >
        Who changed what in this portal, newest first.
        {loaded && logs.length >= limit ? ` Only the latest ${limit} changes are shown.` : ''}
      </PageIntro>

      <LoadState
        loading={loading}
        error={loadError}
        what="the audit trail"
        onRetry={onRetry}
        isEmpty={shown.length === 0}
        empty={{
          icon: <History size={28} />,
          title: area ? `No changes in ${area.toLowerCase()}` : 'No changes recorded yet',
          description: 'When staff add or change something in the portal, it shows up here.',
        }}
      >
        <div style={styles.days}>
          {days.map((day) => (
            <section key={day.key} aria-label={day.label}>
              <h3 style={styles.dayTitle}>{day.label}</h3>
              <ol style={styles.list}>
                {day.entries.map(({ log, at }) => {
                  const person = who(log.user);
                  const pending = log.id.startsWith('log-pending-');
                  return (
                    <li key={log.id} style={styles.entry}>
                      <span style={styles.time}>{at ? timeOf(at) : '—'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={styles.sentence}>{sentence(log)}</div>
                        <div style={styles.meta}>
                          <Badge variant="neutral" size="sm">
                            {areaOf(log.entity)}
                          </Badge>
                          <span>
                            {person.name}
                            {person.role ? <span style={styles.role}> · {person.role}</span> : null}
                          </span>
                          {pending ? <span style={styles.role}>Saving…</span> : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      </LoadState>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  filter: {
    minWidth: '180px',
  },
  days: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  dayTitle: {
    margin: '0 0 8px',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
  },
  entry: {
    display: 'flex',
    gap: '16px',
    alignItems: 'flex-start',
    padding: '12px 16px',
    borderTop: '1px solid var(--border-subtle)',
    marginTop: '-1px',
  },
  time: {
    flexShrink: 0,
    width: '44px',
    fontSize: '0.82rem',
    color: 'var(--text-dim)',
    fontVariantNumeric: 'tabular-nums',
    paddingTop: '1px',
  },
  sentence: {
    fontSize: '0.9rem',
    color: 'var(--text-main)',
    lineHeight: 1.45,
    overflowWrap: 'anywhere',
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '6px',
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
  },
  role: {
    color: 'var(--text-dim)',
  },
};
