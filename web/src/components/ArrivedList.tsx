import React from 'react';
import type { StaffAlert } from '../services/api';

/** Unseen customer orders and Talk to us requests. Seeing one removes it from the list. */
export const ArrivedList: React.FC<{
  alerts: StaffAlert[];
  onSeen: (id: number) => void;
  onOpen: (kind: StaffAlert['kind']) => void;
}> = ({ alerts, onSeen, onOpen }) => {
  if (!alerts.length) return null;
  return (
    <ul style={styles.list}>
      {alerts.map((alert) => (
        <li key={alert.id} style={styles.row}>
          <div style={{ minWidth: 0 }}>
            <div style={styles.headline}>{alert.headline}</div>
            <div style={styles.detail}>{alert.detail}</div>
          </div>
          <div style={styles.actions}>
            <button type="button" style={styles.open} onClick={() => onOpen(alert.kind)}>
              {alert.kind === 'order' ? 'Orders' : 'Talk to us'}
            </button>
            <button type="button" style={styles.seen} onClick={() => onSeen(alert.id)}>
              Seen
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
};

const styles: Record<string, React.CSSProperties> = {
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '10px 12px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
  },
  headline: {
    fontWeight: 650,
    fontSize: '0.86rem',
    color: 'var(--text-main)',
  },
  detail: {
    fontSize: '0.76rem',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
  actions: {
    display: 'flex',
    gap: '6px',
    flexShrink: 0,
  },
  open: {
    border: '1px solid var(--border-medium)',
    background: 'var(--bg-surface-elevated)',
    color: 'var(--text-main)',
    borderRadius: 'var(--radius-md)',
    padding: '6px 10px',
    fontSize: '0.76rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  seen: {
    border: 'none',
    background: 'var(--accent)',
    color: 'white',
    borderRadius: 'var(--radius-md)',
    padding: '6px 10px',
    fontSize: '0.76rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
