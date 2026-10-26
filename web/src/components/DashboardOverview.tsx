import React from 'react';
import {
  Package,
  ShoppingBag,
  Users,
  Image as ImageIcon,
  Tag,
  LayoutGrid,
  LayoutList,
  Building2,
  ScrollText,
  FolderTree,
  ArrowRight,
} from 'lucide-react';
import { StatGrid } from './ui';
import type { StatItem } from './ui';
import type { TabId } from './Sidebar';
import type { Banner, BulkPriceTier, Product } from '../types';
import { isOpenOrder } from '../services/orderStatus';
import { ArrivedList } from './ArrivedList';
import type { StaffAlert } from '../services/api';
import { isBannerLive } from '../services/bannerLive';

/** Which pieces have loaded at least once; until then their figures read "—", never 0. */
export interface LoadedPieces {
  products: boolean;
  categories: boolean;
  orders: boolean;
  users: boolean;
  banners: boolean;
  tiers: boolean;
  sections: boolean;
  audit: boolean;
}

interface DashboardOverviewProps {
  adminName: string;
  products: Product[];
  /** Whole catalogue size (meta.total); `products` is only the loaded page. */
  catalogTotal?: number;
  orders: { status?: string | null }[];
  users: unknown[];
  banners: Banner[];
  bulkTiers: BulkPriceTier[];
  sectionsCount: number;
  sectionsEnabled: number;
  loaded: LoadedPieces;
  onNavigate: (tab: TabId) => void;
  /** Tiles and shortcuts only appear for modules the signed-in role can view. */
  canView: (tab: TabId) => boolean;
  alerts?: StaffAlert[];
  onSeen?: (id: number) => void;
}

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  adminName,
  products,
  catalogTotal,
  orders,
  users,
  banners,
  bulkTiers,
  sectionsCount,
  sectionsEnabled,
  loaded,
  onNavigate,
  canView,
  alerts = [],
  onSeen,
}) => {
  const liveBanners = banners.filter((b) => isBannerLive(b)).length;
  const openOrders = orders.filter((o) => isOpenOrder(o.status)).length;
  const inStock = products.filter((p) => p.stockStatus === 'in_stock').length;
  const productTotal = catalogTotal && catalogTotal > 0 ? catalogTotal : products.length;
  const name = adminName.trim();
  const NOT_LOADED = 'Not loaded yet';

  const stats: (StatItem & { tab: TabId })[] = [
    {
      tab: 'catalog',
      label: 'Products',
      value: loaded.products ? productTotal.toLocaleString('en-IN') : '—',
      icon: <Package size={20} />,
      iconColor: 'var(--info)',
    },
    {
      tab: 'orders',
      label: 'Orders still to deliver',
      value: loaded.orders ? openOrders : '—',
      icon: <ShoppingBag size={20} />,
      iconColor: 'var(--accent)',
    },
    {
      tab: 'users',
      label: 'Customers',
      value: loaded.users ? users.length.toLocaleString('en-IN') : '—',
      icon: <Users size={20} />,
      iconColor: 'var(--violet)',
    },
    {
      tab: 'banners',
      label: 'Banners live in the app',
      value: loaded.banners ? liveBanners : '—',
      icon: <ImageIcon size={20} />,
      iconColor: 'var(--success)',
    },
  ];

  const shortcuts: { tab: TabId; title: string; desc: string; icon: React.ReactNode }[] = [
    {
      tab: 'catalog',
      title: 'Products',
      desc: !loaded.products
        ? NOT_LOADED
        : productTotal > products.length
          ? 'Names, selling units, prices and stock'
          : `${inStock} of ${plural(products.length, 'product')} in stock`,
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
      title: 'Campaign banners',
      desc: loaded.banners ? `${liveBanners} live now, ${plural(banners.length, 'banner')} in all` : NOT_LOADED,
      icon: <ImageIcon size={18} color="var(--info)" />,
    },
    {
      tab: 'sections',
      title: 'Home screen sections',
      desc: loaded.sections ? `${sectionsEnabled} of ${sectionsCount} shown on the app home screen` : NOT_LOADED,
      icon: <LayoutList size={18} color="var(--violet)" />,
    },
    {
      tab: 'shortcuts',
      title: 'Shortcuts & projects',
      desc: 'The category row, project tiles, search ideas and deals on the app home screen',
      icon: <LayoutGrid size={18} color="var(--violet)" />,
    },
    {
      tab: 'about',
      title: 'About the company',
      desc: 'The mission, facts and values on About us',
      icon: <Building2 size={18} color="var(--accent)" />,
    },
    {
      tab: 'policies',
      title: 'Policies',
      desc: 'Privacy, terms, cancellation and shipping',
      icon: <ScrollText size={18} color="var(--accent)" />,
    },
    {
      tab: 'pricing',
      title: 'Bulk pricing',
      desc: loaded.tiers ? plural(bulkTiers.length, 'quantity discount') : NOT_LOADED,
      icon: <Tag size={18} color="var(--warning)" />,
    },
  ];

  const visibleStats = stats.filter((item) => canView(item.tab));
  const visibleShortcuts = shortcuts.filter((item) => canView(item.tab));

  return (
    <div style={styles.container}>
      <div style={styles.heroRow}>
        <div>
          <h2 style={styles.heading}>{name ? `Welcome back, ${name}` : 'Welcome back'}</h2>
          <p style={styles.sub}>
            Everything you change here reaches the customer app straight away: products, prices, banners,
            the home screen, and orders.
          </p>
        </div>
      </div>

      {alerts.length > 0 && onSeen ? (
        <section aria-label="Just arrived">
          <div style={styles.sectionLabel}>Just arrived</div>
          <ArrivedList
            alerts={alerts}
            onSeen={onSeen}
            onOpen={(kind) => onNavigate(kind === 'request' ? 'requests' : 'orders')}
          />
        </section>
      ) : null}

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
