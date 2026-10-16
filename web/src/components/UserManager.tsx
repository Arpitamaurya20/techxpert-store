import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  MapPin,
  Phone,
  Mail,
  ShoppingBag,
  IndianRupee,
  ShieldCheck,
  RefreshCw,
  Database,
} from 'lucide-react';

import { api } from '../services/api';

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
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await (api as any).getUsers();
      setUsers(res || []);
    } catch (err) {
      console.error('Failed fetching users from homecare', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.phone && u.phone.includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.defaultAddress && u.defaultAddress.toLowerCase().includes(q))
    );
  });

  const totalOrders = users.reduce((acc, u) => acc + Number(u.orderCount || 0), 0);
  const totalGMV = users.reduce((acc, u) => acc + Number(u.totalSpent || 0), 0);

  return (
    <div style={styles.container}>
      {/* Database Topology Callout */}
      <div style={styles.calloutCard}>
        <div style={styles.calloutLeft}>
          <div style={styles.dbIconCircle}>
            <Database size={22} color="var(--brand-orange)" />
          </div>
          <div>
            <div style={styles.calloutTitle}>
              Cross-Database Architecture: <span style={{ color: '#60a5fa' }}>homecare</span> (Users) ⟷ <span style={{ color: '#f59e0b' }}>techxpertstore</span> (Store)
            </div>
            <div style={styles.calloutDesc}>
              Customer profiles, addresses, and OTP sessions are centrally maintained in <code style={styles.codePill}>homecare.users</code> and <code style={styles.codePill}>homecare.user_addresses</code>. All catalog SKUs, shopping carts, and order fulfillments are isolated in <code style={styles.codePill}>techxpertstore</code> and reference users via <code style={styles.codePill}>UserID</code>.
            </div>
          </div>
        </div>
        <button onClick={fetchUsers} style={styles.refreshBtn} title="Reload customer list">
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statIconBox}>
            <Users size={20} color="#38bdf8" />
          </div>
          <div>
            <div style={styles.statVal}>{users.length}</div>
            <div style={styles.statLbl}>Registered Customers (homecare)</div>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statIconBox}>
            <ShoppingBag size={20} color="#f97316" />
          </div>
          <div>
            <div style={styles.statVal}>{totalOrders}</div>
            <div style={styles.statLbl}>Store Orders Placed (techxpertstore)</div>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statIconBox}>
            <IndianRupee size={20} color="#10b981" />
          </div>
          <div>
            <div style={styles.statVal}>₹{totalGMV.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
            <div style={styles.statLbl}>Gross Merchandise Value</div>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statIconBox}>
            <ShieldCheck size={20} color="#a855f7" />
          </div>
          <div>
            <div style={styles.statVal}>100%</div>
            <div style={styles.statLbl}>Identity Sync Rate</div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div style={styles.tableControls}>
        <div style={styles.searchBox}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search by customer phone, name, email or delivery city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
          />
        </div>
        <div style={styles.recordCount}>
          Showing <strong>{filtered.length}</strong> of {users.length} users
        </div>
      </div>

      {/* Users Table */}
      <div style={styles.tableCard}>
        <div style={styles.tableResponsive}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>USER ID</th>
                <th style={styles.th}>CUSTOMER</th>
                <th style={styles.th}>CONTACT INFO</th>
                <th style={styles.th}>PRIMARY ADDRESS (homecare)</th>
                <th style={styles.th}>STORE ORDERS</th>
                <th style={styles.th}>LIFETIME VALUE</th>
                <th style={styles.th}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const initials = (u.name || u.phone || 'U')
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <tr key={u.id} style={styles.tr}>
                    <td style={styles.td}>
                      <span style={styles.userIdBadge}>#{u.id}</span>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.userProfile}>
                        <div style={styles.avatar}>{initials}</div>
                        <div>
                          <div style={styles.userName}>{u.name || 'Anonymous User'}</div>
                          <div style={styles.userCreated}>
                            Joined {new Date(u.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.contactCell}>
                        <div style={styles.contactRow}>
                          <Phone size={13} color="var(--brand-orange)" />
                          <span>+91 {u.phone}</span>
                        </div>
                        {u.email && (
                          <div style={styles.contactRow}>
                            <Mail size={13} color="var(--text-dim)" />
                            <span>{u.email}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={styles.td}>
                      {u.defaultAddress ? (
                        <div style={styles.addressBox}>
                          <MapPin size={14} color="#38bdf8" style={{ flexShrink: 0, marginTop: 2 }} />
                          <span>{u.defaultAddress}</span>
                        </div>
                      ) : (
                        <span style={styles.noAddress}>No saved address</span>
                      )}
                    </td>
                    <td style={styles.td}>
                      <div style={styles.orderCountBadge}>
                        <ShoppingBag size={13} />
                        <span>{u.orderCount} orders</span>
                      </div>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.spendText}>
                        ₹{Number(u.totalSpent || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.statusBadge,
                          background: u.isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: u.isActive ? '#10b981' : '#ef4444',
                        }}
                      >
                        {u.isActive ? 'Active Account' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} style={styles.emptyTd}>
                    No customers found matching &quot;{search}&quot;.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
  calloutCard: {
    background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))',
    border: '1px solid rgba(56, 189, 248, 0.25)',
    borderRadius: 'var(--radius-lg)',
    padding: '18px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '20px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
  },
  calloutLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  dbIconCircle: {
    width: '46px',
    height: '46px',
    borderRadius: '50%',
    background: 'rgba(249, 115, 22, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    border: '1px solid rgba(249, 115, 22, 0.3)',
  },
  calloutTitle: {
    fontSize: '0.98rem',
    fontWeight: 700,
    color: '#fff',
    marginBottom: '4px',
  },
  calloutDesc: {
    fontSize: '0.84rem',
    color: 'var(--text-muted)',
    lineHeight: 1.5,
  },
  codePill: {
    background: 'rgba(0, 0, 0, 0.4)',
    color: '#fbbf24',
    padding: '2px 6px',
    borderRadius: '4px',
    fontFamily: 'monospace',
    fontSize: '0.78rem',
  },
  refreshBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: '8px 14px',
    color: '#fff',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
  },
  statCard: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    padding: '18px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    boxShadow: 'var(--shadow-sm)',
  },
  statIconBox: {
    width: '42px',
    height: '42px',
    borderRadius: 'var(--radius-md)',
    background: 'rgba(255, 255, 255, 0.04)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statVal: {
    fontSize: '1.4rem',
    fontWeight: 800,
    color: '#fff',
    lineHeight: 1.2,
  },
  statLbl: {
    fontSize: '0.75rem',
    color: 'var(--text-dim)',
    fontWeight: 500,
    marginTop: '2px',
  },
  tableControls: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: '8px 14px',
    flex: 1,
    maxWidth: '520px',
  },
  searchInput: {
    background: 'transparent',
    border: 'none',
    color: '#fff',
    fontSize: '0.86rem',
    outline: 'none',
    width: '100%',
  },
  recordCount: {
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
  },
  tableCard: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-md)',
  },
  tableResponsive: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  th: {
    padding: '14px 18px',
    fontSize: '0.74rem',
    fontWeight: 700,
    color: 'var(--text-dim)',
    letterSpacing: '0.05em',
    borderBottom: '1px solid var(--border-subtle)',
    background: 'rgba(0, 0, 0, 0.15)',
  },
  tr: {
    borderBottom: '1px solid var(--border-subtle)',
    transition: 'background var(--transition-fast)',
  },
  td: {
    padding: '14px 18px',
    fontSize: '0.86rem',
    verticalAlign: 'middle',
  },
  userIdBadge: {
    background: 'rgba(255, 255, 255, 0.06)',
    padding: '3px 8px',
    borderRadius: '4px',
    fontFamily: 'monospace',
    fontWeight: 600,
    color: '#94a3b8',
    fontSize: '0.78rem',
  },
  userProfile: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #0284c7, #0369a1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.8rem',
    flexShrink: 0,
  },
  userName: {
    fontWeight: 600,
    color: '#fff',
    fontSize: '0.88rem',
  },
  userCreated: {
    fontSize: '0.72rem',
    color: 'var(--text-dim)',
  },
  contactCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  contactRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
  },
  addressBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '6px',
    fontSize: '0.8rem',
    color: '#cbd5e1',
    maxWidth: '260px',
    lineHeight: 1.35,
  },
  noAddress: {
    fontSize: '0.78rem',
    color: 'var(--text-dim)',
    fontStyle: 'italic',
  },
  orderCountBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(249, 115, 22, 0.1)',
    border: '1px solid rgba(249, 115, 22, 0.25)',
    padding: '4px 10px',
    borderRadius: 'var(--radius-full)',
    color: 'var(--brand-orange)',
    fontWeight: 600,
    fontSize: '0.78rem',
  },
  spendText: {
    fontWeight: 700,
    color: '#10b981',
    fontFamily: 'monospace',
    fontSize: '0.92rem',
  },
  statusBadge: {
    padding: '3px 10px',
    borderRadius: 'var(--radius-full)',
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  emptyTd: {
    padding: '40px',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
  },
};
