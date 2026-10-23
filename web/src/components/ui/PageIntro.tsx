import React from 'react';

interface PageIntroProps {
  /** One or two sentences on what this screen is for. */
  children: React.ReactNode;
  /** The screen's own actions: Refresh, New… */
  actions?: React.ReactNode;
}

export const PageIntro: React.FC<PageIntroProps> = ({ children, actions }) => (
  <div style={styles.row}>
    <p style={styles.text}>{children}</p>
    {actions ? <div style={styles.actions}>{actions}</div> : null}
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap',
  },
  text: {
    margin: 0,
    flex: '1 1 420px',
    maxWidth: '760px',
    fontSize: '0.84rem',
    lineHeight: 1.5,
    color: 'var(--text-muted)',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
};
