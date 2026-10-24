import { useEffect, useRef } from 'react';
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
  LifeBuoy,
  FolderTree,
  MapPin,
  ShieldCheck,
  Store,
  KeyRound,
  LogOut,
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
  | 'help'
  | 'api'
  | 'audit'
  | 'access';

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  ordersCount?: number;
  productsCount?: number;
  usersCount?: number;
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
  const allGroups: { label: string; items: NavItem[] }[] = [
    {
      label: 'Daily work',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
        { id: 'orders', label: 'Orders', icon: <ShoppingBag size={18} />, badge: ordersCount?.toLocaleString('en-IN') },
        { id: 'users', label: 'Customers', icon: <Users size={18} />, badge: usersCount?.toLocaleString('en-IN') },
        { id: 'delivery', label: 'Delivery pincodes', icon: <MapPin size={18} /> },
      ],
    },
    {
      label: 'Catalogue',
      items: [
        { id: 'catalog', label: 'Products', icon: <Package size={18} />, badge: productsCount?.toLocaleString('en-IN') },
        { id: 'categories', label: 'Categories', icon: <FolderTree size={18} /> },
        { id: 'pricing', label: 'Bulk pricing', icon: <Tag size={18} /> },
      ],
    },
    {
      label: 'App storefront',
      items: [
        { id: 'banners', label: 'Campaign banners', icon: <ImageIcon size={18} /> },
        { id: 'sections', label: 'Home screen sections', icon: <LayoutList size={18} /> },
        { id: 'help', label: 'Help & support', icon: <LifeBuoy size={18} /> },
      ],
    },
    {
      label: 'Admin',
      items: [
        { id: 'stores', label: 'Stores & groups', icon: <Store size={18} /> },
        { id: 'access', label: 'Roles & access', icon: <ShieldCheck size={18} /> },
        { id: 'audit', label: 'Audit trail', icon: <History size={18} /> },
        { id: 'api', label: 'Developer tools', icon: <Code size={18} /> },
      ],
    },
  ];
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' });
  }, [activeTab]);

  const groups = allGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => visibleTabs.includes(item.id)) }))
    .filter((group) => group.items.length > 0);


  return (
    <aside style={styles.sidebar}>
      {/* Brand Header */}
      <div style={styles.brandBox}>
        <img src="/images/techxpert-logo.gif" alt="Techxpert" style={styles.logoImg} />
        <span style={styles.brandSubtitle}>Store portal</span>
      </div>

      <nav ref={navRef} style={styles.nav} aria-label="Portal">
        {groups.map((group) => (
          <div key={group.label} style={styles.navGroup}>
            <div style={styles.navSectionLabel}>{group.label}</div>
            {group.items.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  aria-current={isActive ? 'page' : undefined}
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
          </div>
        ))}
      </nav>

      <div style={styles.footer}>
        <div style={styles.userCard}>
          <div style={styles.userAvatar} aria-hidden="true">
            {initials}
          </div>
          <div style={styles.userInfo}>
            <div style={styles.userName}>{adminName}</div>
            <div style={styles.userRole}>{adminRole}</div>
          </div>
        </div>
        <div style={styles.footerRow}>
          {onChangePassword && (
            <button type="button" onClick={onChangePassword} style={styles.footerBtn}>
              <KeyRound size={14} />
              Change password
            </button>
          )}
          {onLogout && (
            <button type="button" onClick={onLogout} style={styles.footerBtn}>
              <LogOut size={14} />
              Sign out
            </button>
          )}
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
  nav: {
    flex: 1,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    overflowY: 'auto',
  },
  navGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  navSectionLabel: {
    fontSize: '0.72rem',
    fontWeight: 600,
    color: 'var(--text-dim)',
    padding: '2px 14px',
  },
  navBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 14px',
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
    padding: '12px 14px 14px',
    borderTop: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
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
    minWidth: 0,
  },
  userName: {
    fontSize: '0.82rem',
    fontWeight: 600,
    color: 'var(--text-main)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  userRole: {
    fontSize: '0.7rem',
    color: 'var(--text-dim)',
  },
  footerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '4px',
  },
  footerBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 8px',
    whiteSpace: 'nowrap',
    background: 'none',
    border: '1px solid transparent',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-muted)',
    fontSize: '0.78rem',
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'left',
  },
};
