import React from 'react';
import { Users, ShoppingBag, IndianRupee, Phone, Mail, MapPin } from 'lucide-react';
import { DataTable, StatGrid, Badge, LoadState, NotGiven, PageIntro } from './ui';
import type { Column, StatItem } from './ui';
import { formatDay, inr, isMoney } from '../services/format';

export interface CustomerRecord {
  id: number;
  phone: string;
  email: string | null;
  name: string | null;
  isActive: number;
  createdAt: string;
  /** null when the server couldn't read orders for this list. */
  orderCount: number | null;
  /** Value of the customer's orders, cancelled orders not counted; null when unknown. */
  totalSpent: string | number | null;
  defaultAddress: string | null;
}

interface UserManagerProps {
  customers: CustomerRecord[];
  loading: boolean;
  loadError: string | null;
  /** False until customers have loaded once, so the counts read "—" rather than 0. */
  loaded: boolean;
  onRetry: () => void;
}

const known = (value: unknown): boolean => value !== null && value !== undefined;

export const UserManager: React.FC<UserManagerProps> = ({ customers, loading, loadError, loaded, onRetry }) => {
  const ordersKnown = customers.every((c) => known(c.orderCount));
  const totalOrders = customers.reduce((acc, c) => acc + Number(c.orderCount || 0), 0);
  const totalSpent = customers.reduce((acc, c) => acc + Number(c.totalSpent || 0), 0);
  const unknown = !loaded;

  const stats: StatItem[] = [
    {
      label: 'Customers',
      value: unknown ? '—' : customers.length,
      icon: <Users size={20} />,
      iconColor: 'var(--info)',
    },
    {
      label: 'Orders placed',
      value: unknown || !ordersKnown ? '—' : totalOrders,
      icon: <ShoppingBag size={20} />,
      iconColor: 'var(--accent)',
    },
    {
      label: 'Order value',
      value: unknown || !ordersKnown ? '—' : inr(totalSpent, true),
      subtext: 'Cancelled orders not counted',
      icon: <IndianRupee size={20} />,
      iconColor: 'var(--success)',
    },
  ];

  const columns: Column<CustomerRecord>[] = [
    {
      key: 'name',
      header: 'Customer',
      sortable: true,
      render: (c) => {
        const initials = (c.name || c.phone || '?').slice(0, 2).toUpperCase();
        const joined = formatDay(c.createdAt);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={styles.avatar} aria-hidden>
              {initials}
            </div>
            <div>
              <div style={styles.strong}>{c.name || <NotGiven label="Name not given" />}</div>
              <div style={styles.small}>{joined ? `Joined ${joined}` : 'Join date not recorded'}</div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'phone',
      header: 'Contact',
      render: (c) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={styles.contact}>
            <Phone size={12} />
            <span>{c.phone ? `+91 ${c.phone}` : <NotGiven />}</span>
          </div>
          {c.email ? (
            <div style={styles.contact}>
              <Mail size={12} />
              <span>{c.email}</span>
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'defaultAddress',
      header: 'Saved address',
      render: (c) =>
        c.defaultAddress ? (
          <div style={styles.address}>
            <MapPin size={14} color="var(--info)" style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{c.defaultAddress}</span>
          </div>
        ) : (
          <NotGiven label="No saved address" />
        ),
    },
    {
      key: 'orderCount',
      header: 'Orders',
      sortable: true,
      align: 'center',
      render: (c) =>
        known(c.orderCount) ? (
          <span style={styles.number}>{Number(c.orderCount)}</span>
        ) : (
          <NotGiven label="Not available" />
        ),
    },
    {
      key: 'totalSpent',
      header: 'Order value',
      sortable: true,
      align: 'right',
      render: (c) =>
        isMoney(c.totalSpent) ? (
          <span style={styles.number}>{inr(Number(c.totalSpent))}</span>
        ) : (
          <NotGiven label="Not available" />
        ),
    },
    {
      key: 'isActive',
      header: 'Account',
      align: 'center',
      render: (c) => (
        <Badge variant={c.isActive ? 'success' : 'neutral'} size="sm">
          {c.isActive ? 'Active' : 'Switched off'}
        </Badge>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <StatGrid items={stats} columns={3} />

      <PageIntro>
        Customers manage their own name, phone and addresses in the app, so this list is read-only. Order value leaves
        out cancelled orders.
        {loaded && !ordersKnown ? " Order figures couldn't be read this time, so they show as not available." : ''}
      </PageIntro>

      <LoadState
        loading={loading}
        error={loadError}
        what="customers"
        onRetry={onRetry}
        isEmpty={customers.length === 0}
        empty={{
          icon: <Users size={22} />,
          title: 'No customers yet',
          description: 'Customers appear here after they sign up in the app.',
        }}
      >
        <DataTable<CustomerRecord>
          data={customers}
          columns={columns}
          keyExtractor={(c) => c.id}
          searchPlaceholder="Search by name, mobile, email or address…"
          searchKeys={['name', 'phone', 'email', 'defaultAddress']}
          pageSize={10}
          emptyTitle="No customers match"
          emptyDescription="Try another search."
        />
      </LoadState>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'var(--accent-soft)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--accent)',
    fontWeight: 700,
    fontSize: '0.8rem',
    flexShrink: 0,
  },
  strong: {
    fontWeight: 600,
    color: 'var(--text-main)',
    fontSize: '0.88rem',
  },
  small: {
    fontSize: '0.72rem',
    color: 'var(--text-dim)',
  },
  contact: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
  },
  address: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '6px',
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
    maxWidth: '280px',
    lineHeight: 1.35,
  },
  number: {
    fontWeight: 600,
    color: 'var(--text-main)',
    fontVariantNumeric: 'tabular-nums',
  },
};
