import React, { useState } from 'react';
import { ShoppingBag, Clock, CheckCircle2, IndianRupee, Phone, Mail, MapPin, Eye } from 'lucide-react';
import { DataTable, StatGrid, Badge, Button, LoadState, Modal, NotGiven, PageIntro, useConfirm } from './ui';
import type { Column, StatItem } from './ui';
import { formatWhen, inr, isMoney } from '../services/format';
import {
  ORDER_STATUSES,
  isOpenOrder,
  orderStatusLabel,
  orderStatusVariant,
  paymentMethodLabel,
  paymentStatusLabel,
  restocksOnCancel,
  statusChoices,
} from '../services/orderStatus';

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
  onUpdateStatus: (id: string, newStatus: string) => Promise<boolean>;
  loading: boolean;
  /** Why the last load failed; null when it worked. */
  loadError: string | null;
  /** False until orders have loaded once, so the counts read "—" rather than 0. */
  loaded: boolean;
  onRetry: () => void;
  canEdit?: boolean;
}

const ALL = 'all';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const OrdersManager: React.FC<OrdersManagerProps> = ({
  orders,
  onUpdateStatus,
  loading,
  loadError,
  loaded,
  onRetry,
  canEdit = true,
}) => {
  const { confirm, dialog } = useConfirm();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>(ALL);

  const selectedOrder = selectedId ? orders.find((o) => String(o.id) === selectedId) ?? null : null;
  const openCount = orders.filter((o) => isOpenOrder(o.status)).length;
  const deliveredCount = orders.filter((o) => o.status === 'delivered').length;
  const orderValue = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((acc, o) => acc + (Number(o.total) || 0), 0);
  const unknown = !loaded;

  const stats: StatItem[] = [
    {
      label: 'Orders',
      value: unknown ? '—' : orders.length,
      icon: <ShoppingBag size={20} />,
      iconColor: 'var(--info)',
    },
    {
      label: 'Still to deliver',
      value: unknown ? '—' : openCount,
      icon: <Clock size={20} />,
      iconColor: 'var(--accent)',
    },
    {
      label: 'Delivered',
      value: unknown ? '—' : deliveredCount,
      icon: <CheckCircle2 size={20} />,
      iconColor: 'var(--success)',
    },
    {
      label: 'Order value',
      value: unknown ? '—' : inr(orderValue, true),
      subtext: 'Cancelled orders not counted',
      icon: <IndianRupee size={20} />,
      iconColor: 'var(--violet)',
    },
  ];

  const changeStatus = async (order: Order, status: string) => {
    if (status === order.status) return;
    if (status === 'cancelled') {
      const ok = await confirm({
        title: `Cancel order ${order.orderNumber}?`,
        message: (
          <>
            The order stops counting towards order value.{' '}
            {restocksOnCancel(order.orderNumber)
              ? 'Its stock goes back on the shelf.'
              : 'It was imported, so no stock is put back.'}{' '}
            A cancelled order can't be reopened, and nothing is refunded from the portal.
          </>
        ),
        confirmLabel: 'Cancel order',
        cancelLabel: 'Keep order',
        destructive: true,
      });
      if (!ok) return;
    }
    const id = String(order.id);
    try {
      setUpdatingId(id);
      await onUpdateStatus(id, status);
    } finally {
      setUpdatingId(null);
    }
  };

  const statusOptions = (current: string) => {
    const known = (ORDER_STATUSES as readonly string[]).includes(current);
    return (
      <>
        {known ? null : <option value={current}>{orderStatusLabel(current)}</option>}
        {statusChoices(current).map((s) => (
          <option key={s} value={s}>
            {orderStatusLabel(s)}
          </option>
        ))}
      </>
    );
  };

  const statusControl = (o: Order, id: string) =>
    canEdit ? (
      <select
        id={id}
        className="tx-input"
        value={o.status}
        onChange={(e) => changeStatus(o, e.target.value)}
        disabled={updatingId === String(o.id) || o.status === 'cancelled'}
        title={o.status === 'cancelled' ? "A cancelled order can't be reopened." : undefined}
        aria-label={`Status of order ${o.orderNumber}`}
        style={styles.statusSelect}
      >
        {statusOptions(o.status)}
      </select>
    ) : (
      <Badge variant={orderStatusVariant(o.status)} size="sm">
        {orderStatusLabel(o.status)}
      </Badge>
    );

  const filteredOrders = filterStatus === ALL ? orders : orders.filter((o) => o.status === filterStatus);

  const columns: Column<Order>[] = [
    {
      key: 'orderNumber',
      header: 'Order',
      width: '180px',
      sortable: true,
      render: (o) => (
        <div>
          <div style={styles.strong}>{o.orderNumber}</div>
          <div style={styles.small}>{formatWhen(o.placedAt) ?? <NotGiven label="Time not recorded" />}</div>
        </div>
      ),
    },
    {
      key: 'customerName',
      header: 'Customer',
      sortable: true,
      render: (o) => (
        <div>
          <div style={styles.strong}>{o.customerName || <NotGiven />}</div>
          {o.customerMobile ? (
            <div style={styles.phone}>
              <Phone size={11} />
              <span>+91 {o.customerMobile}</span>
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'deliveryAddress',
      header: 'Deliver to',
      render: (o) => (
        <div style={styles.address} title={o.deliveryAddress || undefined}>
          <MapPin size={13} color="var(--info)" style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={styles.ellipsis}>{o.deliveryAddress || <NotGiven />}</span>
        </div>
      ),
    },
    {
      key: 'storeName',
      header: 'Store',
      sortable: true,
      render: (o) => <span style={{ fontSize: '0.8rem' }}>{o.storeName || <NotGiven label="Not recorded" />}</span>,
    },
    {
      key: 'items',
      header: 'Items',
      render: (o) => <span style={styles.muted}>{plural(o.items?.length || 0, 'product')}</span>,
    },
    {
      key: 'total',
      header: 'Total',
      sortable: true,
      align: 'right',
      render: (o) => (
        <div>
          <div style={styles.money}>{isMoney(o.total) ? inr(o.total) : <NotGiven label="Not recorded" />}</div>
          <div style={styles.small}>{paymentMethodLabel(o.paymentMethod) ?? ''}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (o) => statusControl(o, `order-status-${o.id}`),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (o) => (
        <Button
          variant="ghost"
          size="sm"
          icon={<Eye size={14} />}
          onClick={() => setSelectedId(String(o.id))}
          aria-label={`View order ${o.orderNumber}`}
        >
          View
        </Button>
      ),
    },
  ];

  const filtered = filterStatus !== ALL;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <StatGrid items={stats} />

      <PageIntro>
        Newest first. Change the status as the order moves; the customer sees the new status in the app.
        {canEdit ? '' : ' Your role can see orders but not change their status.'}
      </PageIntro>

      <LoadState
        loading={loading}
        error={loadError}
        what="orders"
        onRetry={onRetry}
        isEmpty={orders.length === 0}
        empty={{
          icon: <ShoppingBag size={22} />,
          title: 'No orders yet',
          description: 'Orders appear here as soon as a customer places one in the app.',
        }}
      >
        <DataTable<Order>
          data={filteredOrders}
          columns={columns}
          keyExtractor={(o) => o.id}
          searchPlaceholder="Search by order number, customer, mobile or address…"
          searchKeys={['orderNumber', 'customerName', 'customerMobile', 'deliveryAddress']}
          pageSize={10}
          emptyTitle={filtered ? 'No orders match' : undefined}
          emptyDescription={filtered ? 'Try another status or search.' : 'Try another search.'}
          extraControls={
            <select
              className="tx-input"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              aria-label="Show orders with status"
              style={{ width: 'auto' }}
            >
              <option value={ALL}>All statuses ({orders.length})</option>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {orderStatusLabel(s)} ({orders.filter((o) => o.status === s).length})
                </option>
              ))}
            </select>
          }
        />
      </LoadState>

      {selectedOrder ? (
        <OrderDetail
          order={selectedOrder}
          onClose={() => setSelectedId(null)}
          statusControl={statusControl(selectedOrder, 'order-detail-status')}
        />
      ) : null}
      {dialog}
    </div>
  );
};

const OrderDetail: React.FC<{ order: Order; onClose: () => void; statusControl: React.ReactNode }> = ({
  order,
  onClose,
  statusControl,
}) => {
  const placed = formatWhen(order.placedAt);
  const payment = [paymentMethodLabel(order.paymentMethod), paymentStatusLabel(order.paymentStatus)]
    .filter(Boolean)
    .join(' · ');
  const lines = [
    { label: 'Subtotal', value: order.subtotal },
    ...(Number(order.discountTotal) > 0
      ? [{ label: 'Bulk savings (already in the subtotal)', value: order.discountTotal }]
      : []),
    { label: 'Delivery', value: order.deliveryCharge },
    { label: 'Tax', value: order.taxTotal },
  ];

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Order ${order.orderNumber}`}
      subtitle={placed ? `Placed ${placed}` : 'Time not recorded'}
      maxWidth="680px"
      footer={
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={styles.facts}>
          <div style={styles.fact}>
            <label htmlFor="order-detail-status" style={styles.factLabel}>
              Status
            </label>
            <div>{statusControl}</div>
            {order.status === 'pending' ? (
              <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                {String(order.orderNumber).startsWith('TX-ORD-')
                  ? 'This order is waiting for confirmation. The goods are held. Set it to Confirmed, or cancel it to put the stock back.'
                  : 'This order is waiting for confirmation. Set it to Confirmed when it should go ahead.'}
              </p>
            ) : null}
          </div>
          <div style={styles.fact}>
            <span style={styles.factLabel}>Payment</span>
            <span style={styles.factValue}>{payment || <NotGiven label="Not recorded" />}</span>
          </div>
          <div style={styles.fact}>
            <span style={styles.factLabel}>Store</span>
            <span style={styles.factValue}>{order.storeName || <NotGiven label="Not recorded" />}</span>
          </div>
        </div>

        <div style={styles.twoCol}>
          <section style={styles.card} aria-label="Customer">
            <h4 style={styles.cardTitle}>Customer</h4>
            <div style={styles.strong}>{order.customerName || <NotGiven />}</div>
            <div style={styles.contact}>
              <Phone size={12} />
              {order.customerMobile ? `+91 ${order.customerMobile}` : <NotGiven />}
            </div>
            {order.customerEmail ? (
              <div style={styles.contact}>
                <Mail size={12} />
                {order.customerEmail}
              </div>
            ) : null}
          </section>
          <section style={styles.card} aria-label="Deliver to">
            <h4 style={styles.cardTitle}>Deliver to</h4>
            <div style={styles.addressFull}>{order.deliveryAddress || <NotGiven />}</div>
          </section>
        </div>

        <section aria-label="Items">
          <h4 style={{ ...styles.cardTitle, marginBottom: '8px' }}>
            Items ({order.items?.length || 0})
          </h4>
          <div style={styles.items}>
            {order.items?.length ? (
              order.items.map((it, idx) => (
                <div
                  key={it.id ?? idx}
                  style={{
                    ...styles.itemRow,
                    borderBottom: idx < order.items.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={styles.strong}>{it.name}</div>
                    <div style={styles.small}>
                      {it.sku ? `SKU ${it.sku} · ` : ''}
                      {it.quantity} × {isMoney(it.unitPrice) ? inr(it.unitPrice) : 'price not recorded'}
                      {it.unit ? ` per ${it.unit}` : ''}
                    </div>
                  </div>
                  <div style={styles.money}>
                    {isMoney(it.lineTotal) ? inr(it.lineTotal) : <NotGiven label="Not recorded" />}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ ...styles.itemRow, ...styles.muted }}>No items were recorded on this order.</div>
            )}
          </div>
        </section>

        <section style={styles.totals} aria-label="Totals">
          {lines.map((line) => (
            <div key={line.label} style={styles.totalLine}>
              <span>{line.label}</span>
              {isMoney(line.value) ? <span>{inr(line.value)}</span> : <NotGiven label="Not recorded" />}
            </div>
          ))}
          <div style={styles.grandTotal}>
            <span>Total</span>
            <span>{isMoney(order.total) ? inr(order.total) : <NotGiven label="Not recorded" />}</span>
          </div>
        </section>
      </div>
    </Modal>
  );
};

const styles: Record<string, React.CSSProperties> = {
  strong: {
    fontWeight: 600,
    color: 'var(--text-main)',
    fontSize: '0.86rem',
  },
  small: {
    fontSize: '0.74rem',
    color: 'var(--text-dim)',
    marginTop: '2px',
  },
  muted: {
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
  },
  phone: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.76rem',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
  address: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '6px',
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    maxWidth: '240px',
    lineHeight: 1.35,
  },
  ellipsis: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  money: {
    fontWeight: 700,
    color: 'var(--text-main)',
    fontVariantNumeric: 'tabular-nums',
    fontSize: '0.9rem',
    whiteSpace: 'nowrap',
  },
  statusSelect: {
    width: 'auto',
    padding: '4px 8px',
    fontSize: '0.8rem',
    fontWeight: 600,
  },
  facts: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '12px',
  },
  fact: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minWidth: 0,
  },
  factLabel: {
    fontSize: '0.74rem',
    fontWeight: 600,
    color: 'var(--text-dim)',
  },
  factValue: {
    fontSize: '0.86rem',
    color: 'var(--text-main)',
  },
  twoCol: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '12px',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '14px 16px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-subtle)',
    background: 'var(--tint-1)',
  },
  cardTitle: {
    margin: '0 0 4px',
    fontSize: '0.74rem',
    fontWeight: 700,
    color: 'var(--text-dim)',
  },
  contact: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
  },
  addressFull: {
    fontSize: '0.84rem',
    color: 'var(--text-main)',
    lineHeight: 1.45,
  },
  items: {
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
  },
  itemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
  },
  totals: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '14px 16px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--tint-2)',
  },
  totalLine: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.84rem',
    color: 'var(--text-muted)',
  },
  grandTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '1.02rem',
    fontWeight: 800,
    color: 'var(--text-main)',
    borderTop: '1px solid var(--border-subtle)',
    paddingTop: '8px',
  },
};
