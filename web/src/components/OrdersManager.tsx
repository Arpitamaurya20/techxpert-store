import React, { useState } from 'react';
import {
  Clock,
  MapPin,
  Phone,
  User,
  ShoppingBag,
} from 'lucide-react';

interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice?: number;
  unit?: string;
  categoryId?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  placedAt: string;
  status:
    | 'placed'
    | 'confirmed'
    | 'packed'
    | 'shipped'
    | 'out_for_delivery'
    | 'delivered'
    | 'cancelled';
  items: OrderItem[];
  total: number;
  deliveryAddress?: string;
  customerName?: string;
  customerMobile?: string;
}

interface OrdersManagerProps {
  orders: Order[];
  onUpdateStatus: (id: string, newStatus: string) => Promise<void>;
  loading: boolean;
}

export const OrdersManager: React.FC<OrdersManagerProps> = ({
  orders,
  onUpdateStatus,
  loading,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const statuses = [
    'all',
    'placed',
    'confirmed',
    'packed',
    'shipped',
    'out_for_delivery',
    'delivered',
    'cancelled',
  ];

  const filteredOrders = orders.filter((o) =>
    filterStatus === 'all' ? true : o.status === filterStatus
  );

  const handleStatusChange = async (orderId: string, status: string) => {
    try {
      setUpdatingId(orderId);
      await onUpdateStatus(orderId, status);
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'badge-published';
      case 'confirmed':
      case 'packed':
      case 'shipped':
      case 'out_for_delivery':
        return 'badge-scheduled';
      case 'placed':
        return 'badge-paused';
      case 'cancelled':
        return 'badge-archived';
      default:
        return 'badge-draft';
    }
  };

  return (
    <div style={styles.container}>
      {/* Top Filter Bar */}
      <div style={styles.filterBar}>
        <div style={styles.statusFilters}>
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              style={{
                ...styles.filterBtn,
                ...(filterStatus === s ? styles.filterBtnActive : {}),
              }}
            >
              <span style={{ textTransform: 'capitalize' }}>
                {s.replace(/_/g, ' ')}
              </span>
              <span style={styles.badgeCount}>
                {s === 'all' ? orders.length : orders.filter((o) => o.status === s).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={styles.loadingBox}>Loading active orders from backend...</div>
      ) : filteredOrders.length === 0 ? (
        <div style={styles.emptyBox}>No orders found for this status.</div>
      ) : (
        <div style={styles.orderList}>
          {filteredOrders.map((order) => (
            <div key={order.id} style={styles.orderCard}>
              {/* Order Header */}
              <div style={styles.orderHeader}>
                <div style={styles.orderIdentity}>
                  <div style={styles.orderNum}>{order.orderNumber}</div>
                  <div style={styles.orderTime}>
                    <Clock size={12} />
                    <span>
                      {new Date(order.placedAt).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <div style={styles.headerRight}>
                  <span className={`badge ${getStatusBadgeClass(order.status)}`}>
                    {order.status.replace(/_/g, ' ')}
                  </span>

                  {/* Status Dropdown */}
                  <div style={styles.selectWrap}>
                    <select
                      value={order.status}
                      disabled={updatingId === order.id}
                      onChange={(e) => handleStatusChange(order.id, e.target.value)}
                      style={styles.statusSelect}
                    >
                      <option value="placed">Mark Placed</option>
                      <option value="confirmed">Confirm Order</option>
                      <option value="packed">Packed for Dispatch</option>
                      <option value="shipped">Shipped</option>
                      <option value="out_for_delivery">Out for Delivery</option>
                      <option value="delivered">Delivered to Site</option>
                      <option value="cancelled">Cancel Order</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Customer & Delivery info */}
              <div style={styles.customerStrip}>
                <div style={styles.infoCol}>
                  <User size={13} color="var(--brand-orange)" />
                  <span style={styles.custName}>{order.customerName || 'Contractor Account'}</span>
                </div>
                {order.customerMobile && (
                  <div style={styles.infoCol}>
                    <Phone size={13} color="#38bdf8" />
                    <span>{order.customerMobile}</span>
                  </div>
                )}
                {order.deliveryAddress && (
                  <div style={styles.infoCol}>
                    <MapPin size={13} color="#10b981" />
                    <span style={styles.addrText}>{order.deliveryAddress}</span>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div style={styles.itemsTable}>
                {order.items.map((item, idx) => (
                  <div key={idx} style={styles.itemRow}>
                    <div style={styles.itemMain}>
                      <ShoppingBag size={14} color="var(--text-dim)" />
                      <span style={styles.itemName}>{item.name}</span>
                      <span style={styles.itemUnit}>({item.unit || 'unit'})</span>
                    </div>
                    <div style={styles.itemPricing}>
                      <span style={styles.itemQty}>x {item.quantity}</span>
                      <span style={styles.itemRate}>
                        ₹{item.unitPrice ? item.unitPrice * item.quantity : 0}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Order Footer Total */}
              <div style={styles.orderFooter}>
                <div style={styles.itemCountText}>
                  {order.items.length} materials line item{order.items.length > 1 ? 's' : ''}
                </div>
                <div style={styles.totalBlock}>
                  <span style={styles.totalLabel}>Total Payable:</span>
                  <span style={styles.totalVal}>₹{order.total?.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'var(--bg-surface)',
    padding: '6px',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-subtle)',
    overflowX: 'auto',
  },
  statusFilters: {
    display: 'flex',
    gap: '4px',
  },
  filterBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 14px',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.8rem',
    fontWeight: 500,
    color: 'var(--text-muted)',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  },
  filterBtnActive: {
    background: 'var(--bg-surface-elevated)',
    color: '#fff',
    fontWeight: 600,
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
  },
  badgeCount: {
    padding: '1px 6px',
    borderRadius: 'var(--radius-full)',
    background: 'rgba(255,255,255,0.08)',
    fontSize: '0.7rem',
  },
  loadingBox: {
    padding: '40px',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
  },
  emptyBox: {
    padding: '40px',
    textAlign: 'center',
    color: 'var(--text-dim)',
    background: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
  },
  orderList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  orderCard: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  orderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
    borderBottom: '1px solid var(--border-subtle)',
    paddingBottom: '12px',
  },
  orderIdentity: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  orderNum: {
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '1.1rem',
    color: '#fff',
    letterSpacing: '0.02em',
  },
  orderTime: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '0.75rem',
    color: 'var(--text-dim)',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  selectWrap: {
    position: 'relative',
  },
  statusSelect: {
    background: 'var(--bg-surface-elevated)',
    border: '1px solid var(--border-medium)',
    color: '#fff',
    padding: '6px 12px',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
    outline: 'none',
  },
  customerStrip: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
    flexWrap: 'wrap',
    background: 'rgba(255,255,255,0.02)',
    padding: '10px 14px',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.8rem',
  },
  infoCol: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: 'var(--text-muted)',
  },
  custName: {
    fontWeight: 600,
    color: '#fff',
  },
  addrText: {
    maxWidth: '420px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  itemsTable: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  itemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.84rem',
  },
  itemMain: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  itemName: {
    fontWeight: 600,
    color: '#fff',
  },
  itemUnit: {
    fontSize: '0.75rem',
    color: 'var(--text-dim)',
  },
  itemPricing: {
    display: 'flex',
    alignItems: 'center',
    gap: '18px',
  },
  itemQty: {
    color: 'var(--brand-orange)',
    fontWeight: 600,
    fontSize: '0.8rem',
  },
  itemRate: {
    fontWeight: 700,
    color: '#fff',
  },
  orderFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '12px',
    borderTop: '1px solid var(--border-subtle)',
  },
  itemCountText: {
    fontSize: '0.78rem',
    color: 'var(--text-dim)',
  },
  totalBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  totalLabel: {
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
  },
  totalVal: {
    fontFamily: 'var(--font-display)',
    fontSize: '1.25rem',
    fontWeight: 800,
    color: 'var(--brand-orange)',
  },
};
