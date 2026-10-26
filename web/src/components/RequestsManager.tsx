import React, { useState } from 'react';
import type { TalkRequest } from '../services/api';
import { formatWhen, inr } from '../services/format';
import { PlaceOrderDialog } from './PlaceOrderDialog';
import type { PlaceOrderSeed, PlacedOrder } from './placeOrderForm';
import { Button, LoadState, PageIntro } from './ui';

export const RequestsManager: React.FC<{
  requests: TalkRequest[];
  loading: boolean;
  loadError: string | null;
  onRetry: () => void;
  canEdit: boolean;
  onUpdated: (request: TalkRequest) => void;
  onAudit: (action: string, details: string) => void;
  saveStatus: (id: string, status: 'new' | 'closed') => Promise<TalkRequest>;
  onPlace?: (body: unknown) => Promise<PlacedOrder>;
  onPlaced?: (order: PlacedOrder) => void;
}> = ({ requests, loading, loadError, onRetry, canEdit, onUpdated, onAudit, saveStatus, onPlace, onPlaced }) => {
  const [filter, setFilter] = useState<'new' | 'closed' | 'all'>('new');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [placeSeed, setPlaceSeed] = useState<PlaceOrderSeed | null>(null);
  const shown = requests.filter((request) => filter === 'all' || request.status === filter);
  const waiting = requests.filter((request) => request.status === 'new').length;

  const change = async (request: TalkRequest, status: 'new' | 'closed') => {
    try {
      setBusyId(request.id);
      setError(null);
      const saved = await saveStatus(request.id, status);
      onUpdated(saved);
      onAudit(
        status === 'closed' ? 'Closed a talk request' : 'Reopened a talk request',
        `${request.name}, request ${request.id}`
      );
    } catch (err: any) {
      setError(err?.message || 'The server refused the change.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <LoadState
      loading={loading && requests.length === 0}
      error={loadError}
      what="talk requests"
      onRetry={onRetry}
      isEmpty={requests.length === 0}
      empty={{
        title: 'No requests yet',
        description: 'A customer request appears here when they ask staff to look at a cart. Nothing is ordered until staff place one.',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <PageIntro
          actions={
            <select
              className="tx-input"
              value={filter}
              onChange={(event) => setFilter(event.target.value as 'new' | 'closed' | 'all')}
              aria-label="Show requests"
              style={{ width: 'auto' }}
            >
              <option value="new">Waiting ({waiting})</option>
              <option value="closed">Closed ({requests.length - waiting})</option>
              <option value="all">All ({requests.length})</option>
            </select>
          }
        >
          These are carts a customer asked staff to look at. Nothing is ordered, and no stock is held. Call them, then close the request.
        </PageIntro>
        {error ? <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p> : null}
        {shown.length === 0 ? <p style={{ margin: 0, color: 'var(--text-muted)' }}>Nothing in this filter.</p> : null}
        {shown.map((request) => (
          <article key={request.id} style={styles.card}>
            <header style={styles.head}>
              <div>
                <strong>{request.name}</strong>
                <div style={styles.meta}>
                  +91 {request.phone} · {request.pincode}
                  {request.storeName ? ` · ${request.storeName}` : ''}
                  {formatWhen(request.placedAt) ? ` · ${formatWhen(request.placedAt)}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {onPlace ? (
                  <Button type="button" size="sm" onClick={() => setPlaceSeed(seedFrom(request))}>
                    Place order
                  </Button>
                ) : null}
              {canEdit ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={busyId === request.id}
                  onClick={() => change(request, request.status === 'new' ? 'closed' : 'new')}
                >
                  {request.status === 'new' ? 'Close' : 'Reopen'}
                </Button>
              ) : null}
              </div>
            </header>
            {request.note ? <p style={styles.note}>{request.note}</p> : null}
            <ul style={styles.lines}>
              {request.lines.map((line) => (
                <li key={`${line.productId}-${line.variantId}`}>
                  <span>
                    {line.quantity} × {line.name}
                    {line.variantName ? ` (${line.variantName})` : ''}
                  </span>
                  <span>{inr(line.lineTotal)}</span>
                  {line.note ? <div style={styles.flag}>{line.note}</div> : null}
                </li>
              ))}
            </ul>
            <div style={styles.total}>Total {inr(request.totals.grandTotal)}, including delivery and GST. Not an order.</div>
          </article>
        ))}
      </div>
      {placeSeed && onPlace && onPlaced ? (
        <PlaceOrderDialog
          seed={placeSeed}
          onClose={() => setPlaceSeed(null)}
          place={onPlace}
          onPlaced={(order) => {
            setPlaceSeed(null);
            onPlaced(order);
          }}
        />
      ) : null}
    </LoadState>
  );
};

function seedFrom(request: TalkRequest): PlaceOrderSeed {
  return {
    name: request.name,
    phone: request.phone,
    pincode: request.pincode,
    address: '',
    note: request.note ?? '',
    requestId: request.id,
    lines: request.lines.map((line) => ({
      productId: line.productId,
      variantId: String(line.variantId),
      quantity: String(line.quantity),
    })),
  };
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    border: '1px solid var(--border-subtle)',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxWidth: '720px',
  },
  head: { display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' },
  meta: { color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' },
  note: { margin: 0 },
  lines: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' },
  flag: { color: 'var(--text-muted)', fontSize: '13px' },
  total: { fontWeight: 600 },
};
