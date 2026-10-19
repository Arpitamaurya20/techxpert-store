import {
  Package,
  ShoppingBag,
  Users,
  Tag,
  Image as ImageIcon,
  Code,
  History,
  Server,
} from 'lucide-react';

export type TabId = 'catalog' | 'orders' | 'users' | 'pricing' | 'banners' | 'api' | 'audit';

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  ordersCount?: number;
  productsCount?: number;
  usersCount?: number;
  serverOnline: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  ordersCount = 3,
  productsCount = 7,
  usersCount = 7,
  serverOnline,
}) => {
  const navItems: { id: TabId; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'catalog', label: 'Products & Inventory', icon: <Package size={18} />, badge: String(productsCount) },
    { id: 'orders', label: 'Orders & Fulfillment', icon: <ShoppingBag size={18} />, badge: String(ordersCount) },
    { id: 'users', label: 'Customers (homecare)', icon: <Users size={18} />, badge: String(usersCount) },
    { id: 'pricing', label: 'Bulk Pricing Rules', icon: <Tag size={18} /> },
    { id: 'banners', label: 'Campaign Banners', icon: <ImageIcon size={18} /> },
    { id: 'api', label: 'API & Mobile Sync', icon: <Code size={18} /> },
    { id: 'audit', label: 'Audit Trail', icon: <History size={18} /> },
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
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div style={styles.brandTextWrapper}>
            <span style={styles.brandTitle}>TECHXPERT</span>
            <span style={styles.brandSubtitle}>Admin & Operations</span>
          </div>
        </div>
      </div>

      {/* Backend API Status Pill */}
      <div style={styles.envContainer}>
        <div
          style={{
            ...styles.envPill,
            borderColor: serverOnline ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)',
          }}
        >
          <span
            style={{
              ...styles.envDot,
              background: serverOnline ? '#10b981' : '#f43f5e',
              boxShadow: serverOnline ? '0 0 8px #10b981' : '0 0 8px #f43f5e',
            }}
          />
          <span style={{ color: serverOnline ? '#10b981' : '#f43f5e', fontWeight: 600 }}>
            {serverOnline ? 'Backend API: Connected' : 'Backend Offline'}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav style={styles.nav}>
        <div style={styles.navSectionLabel}>STORE MANAGEMENT</div>
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
              <span
                style={{
                  ...styles.navIcon,
                  color: isActive ? 'var(--brand-orange)' : 'var(--text-muted)',
                }}
              >
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

      {/* Footer Info */}
      <div style={styles.footer}>
        <div style={styles.serverInfoCard}>
          <div style={styles.serverRow}>
            <Server size={14} color="var(--brand-orange)" />
            <span style={styles.serverUrl}>http://localhost:5001</span>
          </div>
          <div style={styles.appSyncText}>Expo App Target: /catalog, /auth, /orders</div>
        </div>

        <div style={styles.userCard}>
          <div style={styles.userAvatar}>AM</div>
          <div style={styles.userInfo}>
            <div style={styles.userName}>Arpit Maurya</div>
            <div style={styles.userRole}>Store Admin</div>
          </div>
        </div>
      </div>
    </aside>
  );
};

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: '260px',
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
  },
  envDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
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
    gap: '12px',
  },
  serverInfoCard: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  serverRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  serverUrl: {
    fontFamily: 'monospace',
    fontSize: '0.74rem',
    color: '#fff',
    fontWeight: 600,
  },
  appSyncText: {
    fontSize: '0.66rem',
    color: 'var(--text-dim)',
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
  },
  userRole: {
    fontSize: '0.7rem',
    color: 'var(--text-dim)',
  },
};
