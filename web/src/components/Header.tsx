import React, { useState } from 'react';
import {
  Bell,
  Sparkles,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle: string;
  onPublishAll: () => void;
  isPublishing: boolean;
  lastPublished: string;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onPublishAll,
  isPublishing,
  lastPublished,
}) => {
  const [showNotificationToast, setShowNotificationToast] = useState(false);

  return (
    <header style={styles.header}>
      {/* Title & Subtitle */}
      <div style={styles.titleArea}>
        <h1 style={styles.title}>{title}</h1>
        <p style={styles.subtitle}>{subtitle}</p>
      </div>

      {/* Right Controls */}
      <div style={styles.actionsArea}>
        {/* Sync Status Badge */}
        <div style={styles.syncStatus}>
          <CheckCircle2 size={15} color="#10b981" />
          <span>Mobile API: Synced</span>
          <span style={styles.divider}>•</span>
          <span style={styles.timeText}>{lastPublished}</span>
        </div>

        {/* Publish Changes Button */}
        <button
          onClick={onPublishAll}
          disabled={isPublishing}
          style={{
            ...styles.publishBtn,
            opacity: isPublishing ? 0.7 : 1,
          }}
          className="btn btn-primary"
        >
          {isPublishing ? (
            <>
              <RefreshCw size={16} className="spin-icon" />
              <span>Deploying to App...</span>
            </>
          ) : (
            <>
              <Sparkles size={16} />
              <span>Publish to Mobile App</span>
            </>
          )}
        </button>

        {/* Notifications */}
        <button
          style={styles.iconBtn}
          onClick={() => setShowNotificationToast(!showNotificationToast)}
          title="Notifications"
        >
          <Bell size={18} color="var(--text-muted)" />
          <span style={styles.badgeDot} />
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
    gap: '16px',
  },
  syncStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    background: 'rgba(16, 185, 129, 0.08)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    borderRadius: 'var(--radius-full)',
    fontSize: '0.75rem',
    color: '#10b981',
    fontWeight: 500,
  },
  divider: {
    color: 'rgba(255, 255, 255, 0.2)',
  },
  timeText: {
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
  },
  publishBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '9px 18px',
    fontSize: '0.86rem',
    fontWeight: 600,
    borderRadius: 'var(--radius-md)',
    background: 'linear-gradient(135deg, #f97316, #ea580c)',
    color: '#fff',
    cursor: 'pointer',
    border: 'none',
    boxShadow: '0 4px 14px rgba(249, 115, 22, 0.35)',
    transition: 'all 0.2s',
  },
  iconBtn: {
    width: '38px',
    height: '38px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-surface-elevated)',
    border: '1px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    position: 'relative',
  },
  badgeDot: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: 'var(--brand-orange)',
    boxShadow: '0 0 6px var(--brand-orange)',
  },
};
