import React from 'react';
import { User, Clock } from 'lucide-react';
import type { AuditLog } from '../types';

interface AuditLogViewerProps {
  logs: AuditLog[];
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ logs }) => {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Audit History & Deployment Trail</h2>
          <p style={styles.subtitle}>
            Immutable log of merchandising changes, publishing events, and pricing adjustments
          </p>
        </div>
      </div>

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
                  <span className={`badge badge-${log.entity === 'publish' ? 'published' : 'draft'}`}>
                    {log.entity}
                  </span>
                </div>
                <div style={styles.timeInfo}>
                  <Clock size={12} />
                  <span>{log.timestamp}</span>
                </div>
              </div>

              <p style={styles.detailsText}>{log.details}</p>

              <div style={styles.userRow}>
                <User size={13} color="var(--brand-orange)" />
                <span>{log.user}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
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
  },
  title: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: '#fff',
  },
  subtitle: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    marginTop: '2px',
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
    background: 'var(--brand-orange)',
    boxShadow: '0 0 10px rgba(249, 115, 22, 0.5)',
    marginTop: '16px',
    flexShrink: 0,
  },
  line: {
    width: '2px',
    flex: 1,
    background: 'rgba(255, 255, 255, 0.08)',
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
    color: '#fff',
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
