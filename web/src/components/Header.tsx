import React from 'react';
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle: string;
  onRefresh: () => void;
  loading: boolean;
  /** null while the first check is running. */
  serverOnline: boolean | null;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onRefresh,
  loading,
  serverOnline,
}) => {
  return (
    <header style={styles.header}>
      {/* Title & Subtitle */}
      <div style={styles.titleArea}>
        <h1 style={styles.title}>{title}</h1>
        <p style={styles.subtitle}>{subtitle}</p>
      </div>

      {/* Right Controls */}
      <div style={styles.actionsArea}>
        <div
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

        {/* Reload Data Button */}
        <button
          onClick={onRefresh}
          disabled={loading}
          style={styles.refreshBtn}
          title="Load the latest data"
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
