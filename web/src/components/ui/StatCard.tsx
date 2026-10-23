import React from 'react';

export interface StatItem {
  id?: string;
  label: string;
  value: string | number;
  icon: React.ReactNode;
  iconColor?: string;
  subtext?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
}

export const StatCard: React.FC<StatItem> = ({
  label,
  value,
  icon,
  iconColor = 'var(--accent)',
  subtext,
  trend,
}) => {
  return (
    <div style={styles.card}>
      <div style={{ ...styles.iconBox, color: iconColor }}>{icon}</div>
      <div style={styles.content}>
        <div style={styles.valRow}>
          <span style={styles.value}>{value}</span>
          {trend && (
            <span
              style={{
                ...styles.trend,
                color: trend.isPositive ? 'var(--success)' : 'var(--danger)',
                background: trend.isPositive ? 'var(--success-soft)' : 'var(--danger-soft)',
              }}
            >
              {trend.value}
            </span>
          )}
        </div>
        <div style={styles.label}>{label}</div>
        {subtext && <div style={styles.subtext}>{subtext}</div>}
      </div>
    </div>
  );
};

export const StatGrid: React.FC<{ items: StatItem[]; columns?: number }> = ({
  items,
  columns,
}) => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: columns
          ? `repeat(${columns}, 1fr)`
          : 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '24px',
      }}
    >
      {items.map((it, idx) => (
        <StatCard key={it.id || idx} {...it} />
      ))}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    padding: '18px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    boxShadow: 'var(--shadow-sm)',
    transition: 'transform var(--transition-fast), border-color var(--transition-fast)',
  },
  iconBox: {
    width: '44px',
    height: '44px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--tint-2)',
    border: '1px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  valRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
  },
  value: {
    fontSize: '1.45rem',
    fontWeight: 800,
    color: 'var(--text-main)',
    lineHeight: 1.1,
    fontFamily: 'var(--font-display)',
  },
  trend: {
    fontSize: '0.72rem',
    fontWeight: 700,
    padding: '2px 6px',
    borderRadius: '4px',
  },
  label: {
    fontSize: '0.76rem',
    color: 'var(--text-dim)',
    fontWeight: 500,
    marginTop: '3px',
  },
  subtext: {
    fontSize: '0.68rem',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
};
