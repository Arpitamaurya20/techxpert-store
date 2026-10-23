import React from 'react';
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle: string;
  onRefresh: () => void;
  loading: boolean;
  serverOnline: boolean;
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
        {/* Backend API Status Badge */}
        <div
          style={{
            ...styles.syncStatus,
            background: serverOnline ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.08)',
            borderColor: serverOnline ? 'rgba(16, 185, 129, 0.25)' : 'rgba(244, 63, 94, 0.25)',
            color: serverOnline ? '#10b981' : '#f43f5e',
          }}
        >
          {serverOnline ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          <span>{serverOnline ? 'Backend Online (Port 5001)' : 'Connecting to API...'}</span>
        </div>

        {/* Reload Data Button */}
        <button
          onClick={onRefresh}
          disabled={loading}
          style={styles.refreshBtn}
          title="Refresh Data from API"
        >
          <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          <span>Sync Data</span>
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
    background: 'rgba(13, 19, 34, 0.8)',
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
    color: '#fff',
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
