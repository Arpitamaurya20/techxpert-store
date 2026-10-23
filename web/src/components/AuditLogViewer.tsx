import React from 'react';
import { User, Clock, History } from 'lucide-react';
import type { AuditLog } from '../types';
import { EmptyState } from './ui';

interface AuditLogViewerProps {
  logs: AuditLog[];
}

function formatTimestamp(value: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ logs }) => {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Change history</h2>
          <p style={styles.subtitle}>Every change staff made in this portal, newest first.</p>
        </div>
        <span style={styles.countPill}>{logs.length} entries</span>
      </div>

      {logs.length === 0 ? (
        <EmptyState
          icon={<History size={28} />}
          title="No changes recorded yet"
          description="When staff add or change a product, banner, price tier or section, it shows up here."
        />
      ) : (
        <div style={styles.timeline}>
          {logs.map((log) => (
            <div key={log.id} style={styles.timelineItem}>
              <div style={styles.dotLineCol}>
                <div style={styles.dot} />
                <div style={styles.line} />
              </div>

              <div style={styles.logCard}>
                <div style={styles.cardHeader}>
                  <div style={styles.actionRow}>
                    <span style={styles.actionName}>{log.action}</span>
                    <span
                      className={`badge badge-${log.entity === 'publish' ? 'published' : 'draft'}`}
                    >
                      {log.entity}
                    </span>
                  </div>
                  <div style={styles.timeInfo}>
                    <Clock size={12} />
                    <span>{formatTimestamp(log.timestamp)}</span>
                  </div>
                </div>

                <p style={styles.detailsText}>{log.details}</p>

                <div style={styles.userRow}>
                  <User size={13} color="var(--accent)" />
                  <span>{log.user}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  title: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: 'var(--text-main)',
  },
  subtitle: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
  countPill: {
    fontSize: '0.76rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    background: 'var(--tint-2)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-full)',
    padding: '6px 12px',
  },
  timeline: {
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  timelineItem: {
    display: 'flex',
    gap: '16px',
  },
  dotLineCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '20px',
  },
  dot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: 'var(--accent)',
    boxShadow: '0 0 10px var(--accent-border)',
    marginTop: '16px',
    flexShrink: 0,
  },
  line: {
    width: '2px',
    flex: 1,
    background: 'var(--tint-3)',
  },
  logCard: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    padding: '16px 20px',
    flex: 1,
    marginBottom: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '8px',
  },
  actionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  actionName: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: 'var(--text-main)',
  },
  timeInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '0.74rem',
    color: 'var(--text-dim)',
  },
  detailsText: {
    fontSize: '0.84rem',
    color: 'var(--text-muted)',
    lineHeight: 1.45,
  },
  userRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.76rem',
    color: 'var(--text-dim)',
    marginTop: '4px',
  },
};
