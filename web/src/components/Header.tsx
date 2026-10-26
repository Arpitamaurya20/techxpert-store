import React, { useState } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, Bell } from 'lucide-react';
import { ArrivedList } from './ArrivedList';
import type { StaffAlert } from '../services/api';

interface HeaderProps {
  title: string;
  subtitle: string;
  onRefresh: () => void;
  loading: boolean;
  /** null while the first check is running. */
  serverOnline: boolean | null;
  alerts?: StaffAlert[];
  onSeen?: (id: number) => void;
  onOpenAlert?: (kind: StaffAlert['kind']) => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onRefresh,
  loading,
  serverOnline,
  alerts = [],
  onSeen,
  onOpenAlert,
}) => {
  const [open, setOpen] = useState(false);
  return (
    <header style={styles.header}>
      {/* Title & Subtitle */}
      <div style={styles.titleArea}>
        <h1 style={styles.title}>{title}</h1>
        <p style={styles.subtitle}>{subtitle}</p>
      </div>

      {/* Right Controls */}
      <div style={styles.actionsArea}>
        {alerts.length > 0 && onSeen && onOpenAlert ? (
          <div style={{ position: 'relative' }}>
            <button type="button" style={styles.refreshBtn} onClick={() => setOpen((value) => !value)}>
              <Bell size={15} />
              <span>New {alerts.length.toLocaleString('en-IN')}</span>
            </button>
            {open ? (
              <div style={styles.panel}>
                <ArrivedList
                  alerts={alerts}
                  onSeen={(id) => {
                    onSeen(id);
                    if (alerts.length === 1) setOpen(false);
                  }}
                  onOpen={(kind) => {
                    setOpen(false);
                    onOpenAlert(kind);
                  }}
                />
              </div>
            ) : null}
          </div>
        ) : null}
        <div
          role="status"
          style={{
            ...styles.syncStatus,
            background:
              serverOnline === null
                ? 'var(--tint-2)'
                : serverOnline
                  ? 'var(--success-soft)'
                  : 'var(--danger-soft)',
            borderColor:
              serverOnline === null
                ? 'var(--border-subtle)'
                : serverOnline
                  ? 'var(--success-border)'
                  : 'var(--danger-border)',
            color: serverOnline === null ? 'var(--text-muted)' : serverOnline ? 'var(--success)' : 'var(--danger)',
          }}
        >
          {serverOnline ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          <span>{serverOnline === null ? 'Checking…' : serverOnline ? 'Connected' : "Can't reach the server"}</span>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          style={styles.refreshBtn}
          title="Load the latest data on this screen"
        >
          <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          <span>Refresh</span>
        </button>
      </div>
    </header>
  );
};

const styles: Record<string, React.CSSProperties> = {
  header: {
    height: '74px',
    padding: '0 32px',
    borderBottom: '1px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'rgba(255, 255, 255, 0.92)',
    backdropFilter: 'blur(12px)',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  titleArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  title: {
    fontSize: '1.35rem',
    fontWeight: 700,
    color: 'var(--text-main)',
  },
  subtitle: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
  },
  actionsArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  syncStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '7px 14px',
    border: '1px solid',
    borderRadius: 'var(--radius-full)',
    fontSize: '0.78rem',
    fontWeight: 600,
  },
  panel: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    width: '360px',
    maxWidth: '70vw',
    zIndex: 20,
  },
  refreshBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 14px',
    fontSize: '0.82rem',
    fontWeight: 600,
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-surface-elevated)',
    border: '1px solid var(--border-medium)',
    color: 'var(--text-main)',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
};
