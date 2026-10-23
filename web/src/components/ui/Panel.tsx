import React from 'react';

interface PanelProps {
  title?: string;
  /** Buttons on the right of the title row. */
  actions?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

/** The one surface card for a screen section. */
export const Panel: React.FC<PanelProps> = ({ title, actions, children, style }) => (
  <section style={{ ...styles.panel, ...style }} aria-label={title}>
    {title || actions ? (
      <div style={styles.header}>
        {title ? <h3 style={styles.title}>{title}</h3> : <span />}
        {actions ? <div style={styles.actions}>{actions}</div> : null}
      </div>
    ) : null}
    {children}
  </section>
);

const styles: Record<string, React.CSSProperties> = {
  panel: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-sm)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  title: {
    margin: 0,
    fontSize: '0.98rem',
    fontWeight: 700,
    color: 'var(--text-main)',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
};
