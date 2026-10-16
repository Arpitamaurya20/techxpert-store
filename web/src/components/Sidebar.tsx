import React from 'react';
import {
  Layers,
  Image as ImageIcon,
  Tag,
  Package,
  History,
  Smartphone,
} from 'lucide-react';

export type TabId = 'banners' | 'sections' | 'pricing' | 'catalog' | 'audit';

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  showMobileSimulator: boolean;
  onToggleSimulator: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  showMobileSimulator,
  onToggleSimulator,
}) => {
  const navItems: { id: TabId; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'banners', label: 'Banners & Hero CMS', icon: <ImageIcon size={18} />, badge: '4' },
    { id: 'sections', label: 'Homepage Layout', icon: <Layers size={18} />, badge: '8' },
    { id: 'pricing', label: 'Bulk Pricing Rules', icon: <Tag size={18} /> },
    { id: 'catalog', label: 'Catalog & Stock', icon: <Package size={18} /> },
    { id: 'audit', label: 'Publishing Audit', icon: <History size={18} /> },
  ];

  return (
    <aside style={styles.sidebar}>
      {/* Brand Header */}
      <div style={styles.brandBox}>
        <div style={styles.logoBadge}>
          <img
            src="/images/techxpert-logo.gif"
            alt="Techxpert Logo"
            style={styles.logoImg}
            onError={(e) => {
              // fallback if gif is loading
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div style={styles.brandTextWrapper}>
            <span style={styles.brandTitle}>TECHXPERT</span>
            <span style={styles.brandSubtitle}>Merchandising Portal</span>
          </div>
        </div>
      </div>

      {/* Environment Pill */}
      <div style={styles.envContainer}>
        <div style={styles.envPill}>
          <span style={styles.envDot} />
          <span>Staging CMS • Live Sync Active</span>
        </div>
      </div>

      {/* Navigation */}
      <nav style={styles.nav}>
        <div style={styles.navSectionLabel}>MERCHANDISING & CONTENT</div>
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              style={{
                ...styles.navBtn,
                ...(isActive ? styles.navBtnActive : {}),
              }}
            >
              <span style={{ ...styles.navIcon, color: isActive ? 'var(--brand-orange)' : 'var(--text-muted)' }}>
                {item.icon}
              </span>
              <span style={styles.navLabel}>{item.label}</span>
              {item.badge && (
                <span style={{ ...styles.navBadge, ...(isActive ? styles.navBadgeActive : {}) }}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Simulator Toggle & Footer */}
      <div style={styles.footer}>
        <button
          onClick={onToggleSimulator}
          style={{
            ...styles.simulatorToggleBtn,
            ...(showMobileSimulator ? styles.simulatorToggleActive : {}),
          }}
          title="Toggle Mobile Simulator"
        >
          <Smartphone size={18} color={showMobileSimulator ? 'var(--brand-orange)' : 'var(--text-muted)'} />
          <span style={styles.toggleText}>
            {showMobileSimulator ? 'Hide Mobile Simulator' : 'Show Mobile Simulator'}
          </span>
          <span style={{
            ...styles.simulatorIndicator,
            background: showMobileSimulator ? '#10b981' : '#64748b',
          }} />
        </button>

        <div style={styles.userCard}>
          <div style={styles.userAvatar}>AM</div>
          <div style={styles.userInfo}>
            <div style={styles.userName}>Arpit Maurya</div>
            <div style={styles.userRole}>Store Admin & Merchandiser</div>
          </div>
        </div>
      </div>
    </aside>
  );
};

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: '270px',
    background: 'var(--bg-sidebar)',
    borderRight: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    height: '100vh',
    position: 'sticky',
    top: 0,
    zIndex: 20,
  },
  brandBox: {
    padding: '24px 20px 16px',
    borderBottom: '1px solid var(--border-subtle)',
  },
  logoBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoImg: {
    height: '38px',
    borderRadius: '6px',
    background: '#fff',
    padding: '2px',
  },
  brandTextWrapper: {
    display: 'flex',
    flexDirection: 'column',
  },
  brandTitle: {
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '1.05rem',
    letterSpacing: '0.04em',
    color: '#fff',
  },
  brandSubtitle: {
    fontSize: '0.72rem',
    color: 'var(--brand-orange)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  envContainer: {
    padding: '12px 20px',
  },
  envPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-full)',
    padding: '6px 12px',
    fontSize: '0.74rem',
    color: 'var(--text-muted)',
    fontWeight: 500,
  },
  envDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: '#10b981',
    boxShadow: '0 0 8px #10b981',
  },
  nav: {
    flex: 1,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    overflowY: 'auto',
  },
  navSectionLabel: {
    fontSize: '0.68rem',
    fontWeight: 700,
    color: 'var(--text-dim)',
    letterSpacing: '0.08em',
    padding: '8px 10px 4px',
  },
  navBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 14px',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-muted)',
    fontSize: '0.88rem',
    fontWeight: 500,
    transition: 'all var(--transition-fast)',
    textAlign: 'left',
    width: '100%',
  },
  navBtnActive: {
    background: 'var(--bg-surface-elevated)',
    color: '#fff',
    fontWeight: 600,
    border: '1px solid rgba(249, 115, 22, 0.25)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
  },
  navIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    flex: 1,
  },
  navBadge: {
    padding: '2px 7px',
    borderRadius: 'var(--radius-full)',
    background: 'rgba(255, 255, 255, 0.08)',
    fontSize: '0.7rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
  navBadgeActive: {
    background: 'var(--brand-orange-light)',
    color: 'var(--brand-orange)',
  },
  footer: {
    padding: '16px 16px 20px',
    borderTop: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  simulatorToggleBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: 'var(--radius-md)',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-main)',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  },
  simulatorToggleActive: {
    borderColor: 'rgba(249, 115, 22, 0.4)',
    background: 'rgba(249, 115, 22, 0.08)',
  },
  toggleText: {
    flex: 1,
    textAlign: 'left',
  },
  simulatorIndicator: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  userCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 10px',
    borderRadius: 'var(--radius-md)',
    background: 'rgba(255, 255, 255, 0.02)',
  },
  userAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #f97316, #d97706)',
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.8rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    overflow: 'hidden',
  },
  userName: {
    fontSize: '0.82rem',
    fontWeight: 600,
    color: '#fff',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  },
  userRole: {
    fontSize: '0.7rem',
    color: 'var(--text-dim)',
  },
};
