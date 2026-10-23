import React, { useState, useEffect } from 'react';
import {
  Users,
  ShoppingBag,
  IndianRupee,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react';
import { api } from '../services/api';
import { DataTable, StatGrid, Badge, Button, useToast } from './ui';
import type { Column, StatItem } from './ui';


interface UserRecord {
  id: number;
  phone: string;
  email: string | null;
  name: string | null;
  isActive: number;
  createdAt: string;
  orderCount: number;
  totalSpent: string | number;
  defaultAddress: string | null;
}

export const UserManager: React.FC = () => {
  const toast = useToast();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await (api as any).getUsers();
      setUsers(res || []);
    } catch (err: any) {
      toast.error(`Couldn't load customers: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const totalOrders = users.reduce((acc, u) => acc + Number(u.orderCount || 0), 0);
  const totalGMV = users.reduce((acc, u) => acc + Number(u.totalSpent || 0), 0);

  const stats: StatItem[] = [
    {
      label: 'Customers',
      value: users.length,
      icon: <Users size={20} />,
      iconColor: 'var(--info)',
    },
    {
      label: 'Orders placed',
      value: totalOrders,
      icon: <ShoppingBag size={20} />,
      iconColor: 'var(--accent)',
    },
    {
      label: 'Total spent',
      value: `₹${totalGMV.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
      icon: <IndianRupee size={20} />,
      iconColor: 'var(--success)',
    },
  ];

  const columns: Column<UserRecord>[] = [
    {
      key: 'id',
      header: 'USER ID',
      width: '90px',
      sortable: true,
      render: (u) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-muted)' }}>
          #{u.id}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'CUSTOMER',
      sortable: true,
      render: (u) => {
        const initials = (u.name || u.phone || 'U').slice(0, 2).toUpperCase();
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
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
              }}
            >
              {initials}
            </div>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.88rem' }}>
                {u.name || (
                  <span style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontWeight: 400 }}>Name not given</span>
                )}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                Joined {new Date(u.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'phone',
      header: 'CONTACT INFO',
      render: (u) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            <Phone size={12} color="var(--accent)" />
            <span>{u.phone ? `+91 ${u.phone}` : 'Not given'}</span>
          </div>
          {u.email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
              <Mail size={12} />
              <span>{u.email}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'defaultAddress',
      header: 'SAVED ADDRESS',
      render: (u) =>
        u.defaultAddress ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '280px', lineHeight: 1.35 }}>
            <MapPin size={14} color="var(--info)" style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{u.defaultAddress}</span>
          </div>
        ) : (
          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
            No saved address
          </span>
        ),
    },
    {
      key: 'orderCount',
      header: 'STORE ORDERS',
      sortable: true,
      align: 'center',
      render: (u) => (
        <Badge variant="brand" icon={<ShoppingBag size={12} />}>
          {u.orderCount} orders
        </Badge>
      ),
    },
    {
      key: 'totalSpent',
      header: 'LIFETIME VALUE',
      sortable: true,
      align: 'right',
      render: (u) => (
        <span style={{ fontWeight: 700, color: 'var(--success)', fontFamily: 'monospace', fontSize: '0.92rem' }}>
          ₹{Number(u.totalSpent || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: 'STATUS',
      align: 'center',
      render: (u) => (
        <Badge variant={u.isActive ? 'success' : 'danger'} dot>
          {u.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--info-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: 'var(--accent-soft)',
              border: '1px solid var(--accent-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Users size={20} color="var(--accent)" />
          </div>
          <div>
            <div style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '3px' }}>
              Customer accounts
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Everyone who has signed in on the app, with their saved address and store orders.
            </div>
          </div>
        </div>
        <Button variant="secondary" size="sm" icon={<RefreshCw size={14} className={loading ? 'spin' : ''} />} onClick={fetchUsers}>
          Refresh
        </Button>
      </div>

      {/* Metrics Row */}
      <StatGrid items={stats} />

      {/* Reusable Data Table */}
      <DataTable<UserRecord>
        data={users}
        columns={columns}
        keyExtractor={(u) => u.id}
        searchPlaceholder="Search customer by name, mobile, email or city..."
        searchKeys={['name', 'phone', 'email', 'defaultAddress']}
        pageSize={10}
        loading={loading}
      />
    </div>
  );
};
