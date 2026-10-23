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
  Radio,
} from 'lucide-react';
import { StatGrid } from './ui';
import type { StatItem } from './ui';
import type { TabId } from './Sidebar';
import type { Banner, BulkPriceTier, Product } from '../types';

interface DashboardOverviewProps {
  products: Product[];
  /** MySQL catalogue size (meta.total); list in `products` is only the loaded page. */
  catalogTotal?: number;
  orders: any[];
  users: any[];
  banners: Banner[];
  bulkTiers: BulkPriceTier[];
  sectionsCount: number;
  sectionsEnabled: number;
  serverOnline: boolean;
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
  serverOnline,
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
      label: 'Catalogue SKUs',
      value: skuTotal,
      icon: <Package size={20} />,
      iconColor: '#38bdf8',
    },
    {
      tab: 'orders',
      label: 'Open Orders',
      value: pendingOrders || orders.length,
      icon: <ShoppingBag size={20} />,
      iconColor: 'var(--brand-orange)',
    },
    {
      tab: 'users',
      label: 'Customers (homecare)',
      value: users.length,
      icon: <Users size={20} />,
      iconColor: '#a78bfa',
    },
    {
      tab: 'banners',
      label: 'Live Banners',
      value: publishedBanners,
      icon: <ImageIcon size={20} />,
      iconColor: '#10b981',
    },
  ];

  const shortcuts: { tab: TabId; title: string; desc: string; icon: React.ReactNode }[] = [
    {
      tab: 'catalog',
      title: 'Inventory Desk',
      desc:
        skuTotal > products.length
          ? `${skuTotal.toLocaleString()} in MySQL · showing ${products.length} on desk`
          : `${inStock}/${products.length || 0} SKUs in stock`,
      icon: <Package size={18} color="#10b981" />,
    },
    {
      tab: 'categories',
      title: 'Categories & Subs',
      desc: 'Trade hierarchy for mobile browse',
      icon: <FolderTree size={18} color="var(--brand-orange)" />,
    },
    {
      tab: 'banners',
      title: 'Campaign Banners',
      desc: `${publishedBanners} published · ${banners.length} total`,
      icon: <ImageIcon size={18} color="#38bdf8" />,
    },
    {
      tab: 'sections',
      title: 'Homepage Sections',
      desc: `${sectionsEnabled}/${sectionsCount} visible on mobile home`,
      icon: <LayoutList size={18} color="#a78bfa" />,
    },
    {
      tab: 'pricing',
      title: 'Bulk Pricing Tiers',
      desc: `${bulkTiers.length} contractor volume rules`,
      icon: <Tag size={18} color="#eab308" />,
    },
  ];

  const visibleStats = stats.filter((item) => canView(item.tab));
  const visibleShortcuts = shortcuts.filter((item) => canView(item.tab));

  return (
    <div style={styles.container}>
      <div style={styles.heroRow}>
        <div>
          <h2 style={styles.heading}>Operations Dashboard</h2>
          <p style={styles.sub}>
            Live merchandising control plane for the Expo customer app — same APIs the mobile
            client consumes for catalog, CMS, pricing, and orders.
          </p>
        </div>
        <div
          style={{
            ...styles.statusChip,
            borderColor: serverOnline ? 'rgba(16,185,129,0.35)' : 'rgba(244,63,94,0.35)',
            color: serverOnline ? '#10b981' : '#f43f5e',
          }}
        >
          <Radio size={14} />
          {serverOnline ? 'API online · :5001' : 'API offline'}
        </div>
      </div>

      {visibleStats.length > 0 ? <StatGrid items={visibleStats} /> : null}

      {visibleShortcuts.length > 0 ? <div style={styles.sectionLabel}>Merchandising workflows</div> : null}
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
    color: '#fff',
    marginBottom: '6px',
  },
  sub: {
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
    maxWidth: '640px',
    lineHeight: 1.55,
  },
  statusChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 14px',
    borderRadius: 'var(--radius-full)',
    border: '1px solid',
    background: 'rgba(255,255,255,0.03)',
    fontSize: '0.78rem',
    fontWeight: 600,
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
    background: 'rgba(255,255,255,0.04)',
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
    color: '#fff',
  },
  shortcutDesc: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
  },
};
