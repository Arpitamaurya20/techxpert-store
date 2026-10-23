import React, { useState } from 'react';
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  IndianRupee,
  Phone,
  MapPin,
  Eye,
} from 'lucide-react';
import { DataTable, StatGrid, Badge, Button, Modal } from './ui';
import type { Column, StatItem } from './ui';

const NotGiven: React.FC = () => (
  <span style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontWeight: 400 }}>Not given</span>
);

const inr = (value: number) =>
  `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const isMoney = (value: unknown): value is number =>
  value !== null && value !== undefined && Number.isFinite(Number(value));

export interface OrderItem {
  id?: number;
  productId: string | number;
  variantId?: number;
  name: string;
  sku?: string;
  quantity: number;
  unitPrice?: number;
  lineTotal?: number;
  unit?: string;
}

export interface Order {
  id: string | number;
  orderNumber: string;
  userId?: number;
  placedAt: string;
  status: string;
  paymentStatus?: string;
  paymentMethod?: string;
  items: OrderItem[];
  total: number;
  subtotal?: number | null;
  taxTotal?: number | null;
  deliveryCharge?: number | null;
  discountTotal?: number | null;
  deliveryAddress?: string | null;
  customerName?: string | null;
  customerMobile?: string;
  customerEmail?: string;
  storeId?: number | null;
  storeName?: string | null;
}

interface OrdersManagerProps {
  orders: Order[];
  onUpdateStatus: (id: string, newStatus: string) => Promise<void>;
  loading: boolean;
  canEdit?: boolean;
}


export const OrdersManager: React.FC<OrdersManagerProps> = ({
  orders,
  onUpdateStatus,
  loading,
  canEdit = true,
}) => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const pendingCount = orders.filter((o) => ['pending', 'placed', 'confirmed'].includes(o.status)).length;
  const deliveredCount = orders.filter((o) => o.status === 'delivered').length;
  const totalRevenue = orders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);

  const stats: StatItem[] = [
    {
      label: 'Total Orders',
      value: orders.length,
      icon: <ShoppingBag size={20} />,
      iconColor: 'var(--info)',
    },
    {
      label: 'Pending Fulfillment',
      value: pendingCount,
      icon: <Clock size={20} />,
      iconColor: 'var(--accent)',
    },
    {
      label: 'Delivered & Completed',
      value: deliveredCount,
      icon: <CheckCircle2 size={20} />,
      iconColor: 'var(--success)',
    },
    {
      label: 'Total Revenue Processed',
      value: `₹${totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
      icon: <IndianRupee size={20} />,
      iconColor: 'var(--violet)',
    },
  ];

  const handleStatusChange = async (orderId: string, status: string) => {
    try {
      setUpdatingId(orderId);
      await onUpdateStatus(orderId, status);
      if (selectedOrder && String(selectedOrder.id) === orderId) {
        setSelectedOrder({ ...selectedOrder, status });
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredOrders = filterStatus === 'all'
    ? orders
    : orders.filter((o) => o.status === filterStatus);

  const columns: Column<Order>[] = [
    {
      key: 'orderNumber',
      header: 'ORDER #',
      width: '180px',
      sortable: true,
      render: (o) => (
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.88rem' }}>{o.orderNumber}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>
            {new Date(o.placedAt).toLocaleString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
      ),
    },
    {
      key: 'customerName',
      header: 'CUSTOMER',
      sortable: true,
      render: (o) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.86rem' }}>
            {o.customerName || <NotGiven />}
          </div>
          {o.customerMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.76rem', color: 'var(--accent)', marginTop: '2px' }}>
              <Phone size={11} />
              <span>+91 {o.customerMobile}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'deliveryAddress',
      header: 'DESTINATION',
      render: (o) => (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '240px', lineHeight: 1.35 }}>
          <MapPin size={13} color="var(--info)" style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {o.deliveryAddress || <NotGiven />}
          </span>
        </div>
      ),
    },
    {
      key: 'storeName',
      header: 'STORE',
      sortable: true,
      render: (o) => (
        <span style={{ fontSize: '0.8rem', color: o.storeName ? 'var(--text-main)' : 'var(--text-dim)' }}>
          {o.storeName || 'Not recorded'}
        </span>
      ),
    },
    {
      key: 'items',
      header: 'ITEMS',
      render: (o) => (
        <Badge variant="neutral" icon={<ShoppingBag size={11} />}>
          {o.items?.length || 0} line items
        </Badge>
      ),
    },
    {
      key: 'total',
      header: 'TOTAL AMOUNT',
      sortable: true,
      align: 'right',
      render: (o) => (
        <div>
          <div style={{ fontWeight: 700, color: 'var(--success)', fontFamily: 'monospace', fontSize: '0.94rem' }}>
            ₹{Number(o.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
            {o.paymentMethod || 'COD'}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'ORDER STATUS',
      align: 'center',
      render: (o) => !canEdit ? (
        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)', textTransform: 'capitalize' }}>
          {String(o.status).replace(/_/g, ' ')}
        </span>
      ) : (
        <select
          value={o.status}
          onChange={(e) => handleStatusChange(String(o.id), e.target.value)}
          disabled={updatingId === String(o.id)}
          style={{

              background: 'var(--tint-2)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '4px 8px',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: 'var(--text-main)',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="pending" style={{ background: 'var(--bg-surface)' }}>Pending</option>
            <option value="confirmed" style={{ background: 'var(--bg-surface)' }}>Confirmed</option>
            <option value="processing" style={{ background: 'var(--bg-surface)' }}>Processing</option>
            <option value="shipped" style={{ background: 'var(--bg-surface)' }}>Shipped</option>
            <option value="delivered" style={{ background: 'var(--bg-surface)' }}>Delivered</option>
            <option value="cancelled" style={{ background: 'var(--bg-surface)' }}>Cancelled</option>
          </select>
        ),
      },
      {

      key: 'actions',
      header: '',
      align: 'right',
      render: (o) => (
        <Button variant="ghost" size="sm" icon={<Eye size={14} />} onClick={() => setSelectedOrder(o)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Metric Cards */}
      <StatGrid items={stats} />

      {/* Main Table */}
      <DataTable<Order>
        data={filteredOrders}
        columns={columns}
        keyExtractor={(o) => o.id}
        searchPlaceholder="Search orders by number, customer, mobile or address..."
        searchKeys={['orderNumber', 'customerName', 'customerMobile', 'deliveryAddress']}
        pageSize={10}
        loading={loading}
        extraControls={
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 12px',
              color: 'var(--text-main)',
              fontSize: '0.84rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all">All Statuses ({orders.length})</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        }
      />

      {/* Order Details Modal */}
      {selectedOrder && (
        <Modal
          isOpen={Boolean(selectedOrder)}
          onClose={() => setSelectedOrder(null)}
          title={`Order ${selectedOrder.orderNumber}`}
          subtitle={`Placed on ${new Date(selectedOrder.placedAt).toLocaleString()}`}
          maxWidth="640px"
          footer={
            <Button variant="secondary" size="sm" onClick={() => setSelectedOrder(null)}>
              Close
            </Button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Customer & Destination Summary */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '14px',
                background: 'var(--tint-1)',
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                  Customer
                </div>
                <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem', marginTop: '4px' }}>
                  {selectedOrder.customerName || <NotGiven />}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--accent)', marginTop: '2px' }}>
                  {selectedOrder.customerMobile ? `+91 ${selectedOrder.customerMobile}` : <NotGiven />}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                  Delivery address
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.4 }}>
                  {selectedOrder.deliveryAddress || <NotGiven />}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '6px' }}>
                  Store: {selectedOrder.storeName || 'not recorded'}
                </div>
              </div>
            </div>

            {/* Line Items List */}
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '10px' }}>
                Order Items ({selectedOrder.items?.length || 0})
              </div>
              <div
                style={{
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                }}
              >
                {selectedOrder.items?.map((it, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      borderBottom: idx < selectedOrder.items.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      background: idx % 2 === 0 ? 'transparent' : 'var(--tint-1)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.86rem' }}>{it.name}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                        {it.sku ? `SKU ${it.sku} • ` : ''}
                        {it.quantity} × {isMoney(it.unitPrice) ? inr(it.unitPrice) : 'price not recorded'}
                        {it.unit ? ` per ${it.unit}` : ''}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)', fontFamily: 'monospace' }}>
                      {isMoney(it.lineTotal) ? inr(it.lineTotal) : <NotGiven />}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Price Breakdown */}
            <div
              style={{
                background: 'var(--tint-2)',
                padding: '14px 18px',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {[
                { label: 'Subtotal', value: selectedOrder.subtotal },
                ...(Number(selectedOrder.discountTotal) > 0
                  ? [{ label: 'Bulk savings (included in subtotal)', value: selectedOrder.discountTotal }]
                  : []),
                { label: 'Delivery', value: selectedOrder.deliveryCharge },
                { label: 'Tax', value: selectedOrder.taxTotal },
              ].map((line) => (
                <div
                  key={line.label}
                  style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', color: 'var(--text-muted)' }}
                >
                  <span>{line.label}</span>
                  {isMoney(line.value) ? (
                    <span>{inr(line.value)}</span>
                  ) : (
                    <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>Not recorded</span>
                  )}
                </div>
              ))}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '1.05rem',
                  fontWeight: 800,
                  color: 'var(--success)',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '8px',
                }}
              >
                <span>Total</span>
                <span>{inr(selectedOrder.total)}</span>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
