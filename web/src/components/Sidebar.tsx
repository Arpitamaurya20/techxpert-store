import {
  Package,
  ShoppingBag,
  Users,
  Tag,
  Image as ImageIcon,
  Code,
  History,
  LayoutDashboard,
  LayoutList,
  FolderTree,
  MapPin,
  ShieldCheck,
  Store,
  KeyRound,
} from 'lucide-react';

export type TabId =
  | 'dashboard'
  | 'catalog'
  | 'categories'
  | 'orders'
  | 'delivery'
  | 'stores'
  | 'users'
  | 'pricing'
  | 'banners'
  | 'sections'
  | 'api'
  | 'audit'
  | 'access';

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  ordersCount?: number;
  productsCount?: number;
  usersCount?: number;
  /** null while the first check is running. */
  serverOnline: boolean | null;
  adminName?: string;
  adminRole?: string;
  onChangePassword?: () => void;
  onLogout?: () => void;
  /** Tabs the signed-in role can open, in display order. */
  visibleTabs: TabId[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  ordersCount,
  productsCount,
  usersCount,
  serverOnline,
  adminName = 'Staff',
  adminRole = 'No role',
  onChangePassword,
  onLogout,
  visibleTabs,
}) => {
  const initials = adminName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || 'SA';
  type NavItem = { id: TabId; label: string; icon: React.ReactNode; badge?: string };
  const allNavItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'catalog', label: 'Products', icon: <Package size={18} />, badge: productsCount?.toLocaleString('en-IN') },
    { id: 'categories', label: 'Categories', icon: <FolderTree size={18} /> },
    { id: 'orders', label: 'Orders', icon: <ShoppingBag size={18} />, badge: ordersCount?.toLocaleString('en-IN') },
    { id: 'delivery', label: 'Delivery Pincodes', icon: <MapPin size={18} /> },
    { id: 'stores', label: 'Stores & Groups', icon: <Store size={18} /> },
    { id: 'users', label: 'Customers', icon: <Users size={18} />, badge: usersCount?.toLocaleString('en-IN') },
    { id: 'pricing', label: 'Bulk Pricing', icon: <Tag size={18} /> },
    { id: 'banners', label: 'Campaign Banners', icon: <ImageIcon size={18} /> },
    { id: 'sections', label: 'Homepage Sections', icon: <LayoutList size={18} /> },
    { id: 'api', label: 'Developer tools', icon: <Code size={18} /> },
    { id: 'audit', label: 'Audit Trail', icon: <History size={18} /> },
    { id: 'access', label: 'Roles & Access', icon: <ShieldCheck size={18} /> },
  ];
  const navItems = allNavItems.filter((item) => visibleTabs.includes(item.id));
  const statusColor = serverOnline === null ? 'var(--text-dim)' : serverOnline ? 'var(--success)' : 'var(--danger)';


  return (
    <aside style={styles.sidebar}>
      {/* Brand Header */}
      <div style={styles.brandBox}>
        <img src="/images/techxpert-logo.gif" alt="Techxpert" style={styles.logoImg} />
        <span style={styles.brandSubtitle}>Store portal</span>
      </div>

      <div style={styles.envContainer}>
        <div
          style={{
            ...styles.envPill,
            borderColor:
              serverOnline === null
                ? 'var(--border-subtle)'
                : serverOnline
                  ? 'var(--success-border)'
                  : 'var(--danger-border)',
          }}
        >
          <span
            style={{
              ...styles.envDot,
              background: statusColor,
              boxShadow: serverOnline === null ? 'none' : `0 0 8px ${statusColor}`,
            }}
          />
          <span style={{ color: statusColor, fontWeight: 600 }}>
            {serverOnline === null ? 'Checking…' : serverOnline ? 'Connected' : "Can't reach the server"}
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
                  color: isActive ? 'var(--accent)' : 'var(--text-muted)',
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
        <div style={styles.userCard}>
          <div style={styles.userAvatar}>{initials}</div>
          <div style={styles.userInfo}>
            <div style={styles.userName}>{adminName}</div>
            <div style={styles.userRole}>{adminRole}</div>
          </div>
          {onLogout && (
            <button type="button" onClick={onLogout} style={styles.logoutBtn} title="Sign out">
              Out
            </button>
          )}
        </div>
        {onChangePassword && (
          <button type="button" onClick={onChangePassword} style={styles.passwordBtn}>
            <KeyRound size={14} />
            Change password
          </button>
        )}
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
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '22px 22px 16px',
    borderBottom: '1px solid var(--border-subtle)',
  },
  logoImg: {
    display: 'block',
    width: '176px',
    maxWidth: '100%',
    height: 'auto',
  },
  brandSubtitle: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  envContainer: {
    padding: '12px 20px',
  },
  envPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'var(--tint-2)',
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
    background: 'none',
    border: '1px solid transparent',
    cursor: 'pointer',
  },
  navBtnActive: {
    background: 'var(--accent-soft)',
    color: 'var(--accent)',
    fontWeight: 600,
    border: '1px solid var(--accent-border)',
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
    background: 'var(--tint-3)',
    fontSize: '0.7rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
  navBadgeActive: {
    background: 'var(--accent-soft)',
    color: 'var(--accent)',
  },
  footer: {
    padding: '16px 16px 20px',
    borderTop: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  userCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 10px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--tint-1)',
  },
  userAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'var(--accent)',
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
    color: 'var(--text-main)',
  },
  userRole: {
    fontSize: '0.7rem',
    color: 'var(--text-dim)',
  },
  passwordBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '7px 10px',
    background: 'none',
    border: '1px solid transparent',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-muted)',
    fontSize: '0.78rem',
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'left',
  },
  logoutBtn: {
    marginLeft: 'auto',
    flexShrink: 0,
    background: 'var(--danger-soft)',
    border: '1px solid var(--danger-border)',
    color: 'var(--danger)',
    borderRadius: 'var(--radius-sm)',
    padding: '4px 8px',
    fontSize: '0.68rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
