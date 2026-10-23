import React from 'react';
import {
  Package,
  ShoppingBag,
  Users,
  Image as ImageIcon,
  Tag,
  LayoutList,
  FolderTree,
  ArrowRight,
} from 'lucide-react';
import { StatGrid } from './ui';
import type { StatItem } from './ui';
import type { TabId } from './Sidebar';
import type { Banner, BulkPriceTier, Product } from '../types';

interface DashboardOverviewProps {
  products: Product[];
  /** Whole catalogue size (meta.total); `products` is only the loaded page. */
  catalogTotal?: number;
  orders: any[];
  users: any[];
  banners: Banner[];
  bulkTiers: BulkPriceTier[];
  sectionsCount: number;
  sectionsEnabled: number;
  onNavigate: (tab: TabId) => void;
  /** Tiles and shortcuts only appear for modules the signed-in role can view. */
  canView: (tab: TabId) => boolean;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  products,
  catalogTotal,
  orders,
  users,
  banners,
  bulkTiers,
  sectionsCount,
  sectionsEnabled,
  onNavigate,
  canView,
}) => {
  const publishedBanners = banners.filter((b) => b.status === 'published').length;
  const pendingOrders = orders.filter((o) =>
    ['pending', 'confirmed', 'processing', 'packed'].includes(String(o.status || '').toLowerCase())
  ).length;
  const inStock = products.filter((p) => p.stockStatus === 'in_stock').length;
  const skuTotal = catalogTotal && catalogTotal > 0 ? catalogTotal : products.length;

  const stats: (StatItem & { tab: TabId })[] = [
    {
      tab: 'catalog',
      label: 'Products',
      value: skuTotal.toLocaleString('en-IN'),
      icon: <Package size={20} />,
      iconColor: 'var(--info)',
    },
    {
      tab: 'orders',
      label: 'Open orders',
      value: pendingOrders,
      icon: <ShoppingBag size={20} />,
      iconColor: 'var(--accent)',
    },
    {
      tab: 'users',
      label: 'Customers',
      value: users.length,
      icon: <Users size={20} />,
      iconColor: 'var(--violet)',
    },
    {
      tab: 'banners',
      label: 'Live banners',
      value: publishedBanners,
      icon: <ImageIcon size={20} />,
      iconColor: 'var(--success)',
    },
  ];

  const shortcuts: { tab: TabId; title: string; desc: string; icon: React.ReactNode }[] = [
    {
      tab: 'catalog',
      title: 'Products',
      desc:
        skuTotal > products.length
          ? `${skuTotal.toLocaleString('en-IN')} products`
          : `${inStock} of ${products.length} in stock`,
      icon: <Package size={18} color="var(--success)" />,
    },
    {
      tab: 'categories',
      title: 'Categories',
      desc: 'What customers browse in the app',
      icon: <FolderTree size={18} color="var(--accent)" />,
    },
    {
      tab: 'banners',
      title: 'Campaign Banners',
      desc: `${publishedBanners} published · ${banners.length} total`,
      icon: <ImageIcon size={18} color="var(--info)" />,
    },
    {
      tab: 'sections',
      title: 'Homepage Sections',
      desc: `${sectionsEnabled} of ${sectionsCount} shown on the app home screen`,
      icon: <LayoutList size={18} color="var(--violet)" />,
    },
    {
      tab: 'pricing',
      title: 'Bulk Pricing',
      desc: `${bulkTiers.length} quantity discount ${bulkTiers.length === 1 ? 'rule' : 'rules'}`,
      icon: <Tag size={18} color="var(--warning)" />,
    },
  ];

  const visibleStats = stats.filter((item) => canView(item.tab));
  const visibleShortcuts = shortcuts.filter((item) => canView(item.tab));

  return (
    <div style={styles.container}>
      <div style={styles.heroRow}>
        <div>
          <h2 style={styles.heading}>Welcome back</h2>
          <p style={styles.sub}>
            Everything you change here reaches the customer app straight away: products, prices, banners,
            the home screen, and orders.
          </p>
        </div>
      </div>

      {visibleStats.length > 0 ? <StatGrid items={visibleStats} /> : null}

      {visibleShortcuts.length > 0 ? <div style={styles.sectionLabel}>Go to</div> : null}
      <div style={styles.shortcutGrid}>
        {visibleShortcuts.map((item) => (
          <button key={item.tab} onClick={() => onNavigate(item.tab)} style={styles.shortcutCard}>
            <div style={styles.shortcutIcon}>{item.icon}</div>
            <div style={styles.shortcutText}>
              <span style={styles.shortcutTitle}>{item.title}</span>
              <span style={styles.shortcutDesc}>{item.desc}</span>
            </div>
            <ArrowRight size={16} color="var(--text-dim)" />
          </button>
        ))}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  heroRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap',
  },
  heading: {
    fontFamily: 'var(--font-display)',
    fontSize: '1.35rem',
    fontWeight: 700,
    color: 'var(--text-main)',
    marginBottom: '6px',
  },
  sub: {
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
    maxWidth: '640px',
    lineHeight: 1.55,
  },
  sectionLabel: {
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-dim)',
    marginTop: '4px',
  },
  shortcutGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '12px',
  },
  shortcutCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '16px 18px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'border-color var(--transition-fast), background var(--transition-fast)',
  },
  shortcutIcon: {
    width: '40px',
    height: '40px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--tint-2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  shortcutText: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  shortcutTitle: {
    fontSize: '0.92rem',
    fontWeight: 600,
    color: 'var(--text-main)',
  },
  shortcutDesc: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
  },
};
