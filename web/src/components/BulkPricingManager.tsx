import React, { useState, useEffect } from 'react';
import {
  Tag,
  Percent,
  Calculator,
  Plus,
  Trash2,
  TrendingDown,
  Pencil,
} from 'lucide-react';
import type { BulkPriceTier, Product } from '../types';
import { DataTable, StatGrid, Badge, Button, Modal } from './ui';
import type { Column, StatItem } from './ui';
import { api } from '../services/api';

interface BulkPricingManagerProps {
  tiers: BulkPriceTier[];
  products: Product[];
  onAddTier: (tier: BulkPriceTier) => void;
  onUpdateTier: (tier: BulkPriceTier) => void;
  onDeleteTier: (id: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const BulkPricingManager: React.FC<BulkPricingManagerProps> = ({
  tiers,
  products,
  onAddTier,
  onUpdateTier,
  onDeleteTier,
  canEdit = true,
  canDelete = true,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '1');
  const [calculatorQty, setCalculatorQty] = useState<number>(25);
  const [lastCalc, setCalcResult] = useState<any>(null);
  const [calcError, setCalcError] = useState<string | null>(null);

  // New tier form state
  const [newTier, setNewTier] = useState<{
    productId: string;
    productName: string;
    minQty: number;
    maxQty?: number;
    discountType: 'percentage' | 'fixed_price';
    discountValue: number;
    terms: string;
  }>({
    productId: products[0]?.id || '1',
    productName: products[0]?.name || '',
    minQty: 10,
    maxQty: 49,
    discountType: 'percentage',
    discountValue: 10,
    terms: 'Contractor bulk rate applied at checkout',
  });

  const selectedProduct = products.find((p) => String(p.id) === String(selectedProductId)) || products[0];
  /** A product without a price has nothing to calculate; never show the previous product's figures. */
  const calcResult = selectedProduct?.price == null ? null : lastCalc;

  useEffect(() => {
    if (!selectedProduct) return;
    const basePrice = selectedProduct.price;
    if (basePrice == null) return;
    let stale = false;
    api
      .calculateBulkPrice(selectedProduct.id, calculatorQty, basePrice)
      .then((data) => {
        if (stale) return;
        setCalcError(null);
        setCalcResult(data);
      })
      .catch((err) => {
        if (stale) return;
        setCalcResult(null);
        setCalcError(err instanceof Error ? err.message : 'The server did not answer.');
      });
    return () => {
      stale = true;
    };
  }, [selectedProductId, calculatorQty, selectedProduct, tiers]);

  const closeTierModal = () => {
    setIsAddModalOpen(false);
    setEditingTierId(null);
  };

  const openCreateTier = () => {
    setEditingTierId(null);
    setNewTier({
      productId: products[0]?.id || '1',
      productName: products[0]?.name || '',
      minQty: 10,
      maxQty: 49,
      discountType: 'percentage',
      discountValue: 10,
      terms: 'Contractor bulk rate applied at checkout',
    });
    setIsAddModalOpen(true);
  };

  const openEditTier = (tier: BulkPriceTier) => {
    setEditingTierId(tier.id);
    setNewTier({
      productId: String(tier.productId || products[0]?.id || '1'),
      productName: tier.productName || '',
      minQty: tier.minQty,
      maxQty: tier.maxQty,
      discountType: tier.discountType === 'fixed_price' ? 'fixed_price' : 'percentage',
      discountValue: Number(tier.discountValue),
      terms: tier.terms || '',
    });
    setIsAddModalOpen(true);
  };

  const handleCreateTier = (e: React.FormEvent) => {
    e.preventDefault();
    const prod = products.find((p) => String(p.id) === String(newTier.productId));
    const payload: BulkPriceTier = {
      id: editingTierId || `tier-${Date.now()}`,
      productId: newTier.productId,
      productName: prod?.name || newTier.productName,
      minQty: Number(newTier.minQty),
      maxQty: newTier.maxQty ? Number(newTier.maxQty) : undefined,
      discountType: newTier.discountType,
      discountValue: Number(newTier.discountValue),
      terms: newTier.terms,
    };
    if (editingTierId) onUpdateTier(payload);
    else onAddTier(payload);
    closeTierModal();
  };

  const percentageTiers = tiers.filter((tier) => tier.discountType !== 'fixed_price');
  const avgDiscount = percentageTiers.length > 0
    ? Math.round(percentageTiers.reduce((acc, t) => acc + Number(t.discountValue), 0) / percentageTiers.length)
    : null;

  const stats: StatItem[] = [
    {
      label: 'Bulk price rules',
      value: tiers.length,
      icon: <Tag size={20} />,
      iconColor: 'var(--accent)',
    },
    {
      label: 'Average % discount',
      value: avgDiscount == null ? '—' : `${avgDiscount}%`,
      icon: <TrendingDown size={20} />,
      iconColor: 'var(--success)',
    },
    {
      label: 'Products with bulk prices',
      value: new Set(tiers.map((t) => t.productId)).size,
      icon: <Percent size={20} />,
      iconColor: 'var(--info)',
    },
  ];

  const columns: Column<BulkPriceTier>[] = [
    {
      key: 'productName',
      header: 'MATERIAL / SKU',
      sortable: true,
      render: (t) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.88rem' }}>{t.productName}</div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '2px' }}>
            ID: #{t.productId}
          </div>
        </div>
      ),
    },
    {
      key: 'quantityRange',
      header: 'QUANTITY THRESHOLD',
      render: (t) => (
        <Badge variant="neutral">
          {t.minQty} {t.maxQty ? `– ${t.maxQty}` : '+'} units
        </Badge>
      ),
    },
    {
      key: 'discountValue',
      header: 'DISCOUNT BENEFIT',
      sortable: true,
      render: (t) => (
        <Badge variant="success" icon={<TrendingDown size={12} />}>
          {t.discountType === 'fixed_price' ? `₹${t.discountValue} / unit` : `${t.discountValue}% OFF`}
        </Badge>
      ),
    },
    {
      key: 'terms',
      header: 'TERMS & INVOICE NOTES',
      render: (t) => (
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {t.terms || 'Applied at checkout'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (t) => (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          {canEdit ? (
            <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => openEditTier(t)}>
              Edit
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 size={14} color="var(--danger)" />}
              onClick={() => onDeleteTier(t.id)}
            >
              Remove
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Metrics Row */}
      <StatGrid items={stats} />

      {/* Interactive Volume Simulator */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Calculator size={20} color="var(--accent)" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
            Price check: what a customer pays for a quantity
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', gap: '14px', marginBottom: '14px' }}>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Select Product</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  style={styles.select}
                >
                  {products.map((p) => (
                    <option key={p.id} value={String(p.id)} style={{ background: 'var(--bg-surface)' }}>
                      {p.name} (Base: ₹{p.price})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ width: '130px' }}>
                <label style={styles.label}>Order Qty</label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={calculatorQty}
                  onChange={(e) => setCalculatorQty(Math.max(1, Number(e.target.value)))}
                  style={styles.input}
                />
              </div>
            </div>

            <input
              type="range"
              min="1"
              max="200"
              value={calculatorQty}
              onChange={(e) => setCalculatorQty(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              <span>1 unit (Retail)</span>
              <span>50 units (Small Trade)</span>
              <span>100+ units (Wholesale)</span>
              <span>200+ units</span>
            </div>
          </div>

          {/* Calculator Output */}
          <div
            style={{
              background: 'var(--tint-2)',
              border: '1px solid var(--accent-border)',
              borderRadius: 'var(--radius-md)',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {calcError && selectedProduct?.price != null && (
              <div role="alert" style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>
                Couldn't calculate this price: {calcError}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <span>Base Retail Rate:</span>
              <span>{selectedProduct?.price == null ? 'No price yet' : `₹${calcResult?.basePrice || selectedProduct.price} / unit`}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <span>Volume Discount:</span>
              <span style={{ color: 'var(--success)', fontWeight: 700 }}>
                {calcResult?.discountPercent || 0}% OFF
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', color: 'var(--text-main)', fontWeight: 600 }}>
              <span>Contractor Unit Rate:</span>
              <span style={{ color: 'var(--accent)', fontWeight: 800, fontFamily: 'monospace' }}>
                {calcResult ? `₹${Number(calcResult.unitPrice).toFixed(2)}` : '—'}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '1rem',
                fontWeight: 800,
                color: 'var(--text-main)',
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: '8px',
                marginTop: '4px',
              }}
            >
              <span>Total Payable ({calculatorQty} units):</span>
              <span style={{ color: 'var(--success)', fontFamily: 'monospace' }}>
                {calcResult
                  ? `₹${Number(calcResult.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                  : '—'}
              </span>
            </div>
            {Number(calcResult?.totalSavings || 0) > 0 && (
              <div style={{ fontSize: '0.74rem', color: 'var(--success)', textAlign: 'right' }}>
                ✨ Contractor saves ₹{Number(calcResult?.totalSavings).toLocaleString('en-IN', { minimumFractionDigits: 2 })} on this order!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tiers Data Table */}
      <DataTable<BulkPriceTier>
        data={tiers}
        columns={columns}
        keyExtractor={(t) => t.id}
        searchPlaceholder="Filter rules by product name or terms..."
        searchKeys={['productName', 'terms']}
        pageSize={8}
        extraControls={
          canEdit ? (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={15} />}
              onClick={openCreateTier}
            >
              Add Pricing Rule
            </Button>
          ) : undefined
        }
      />

      {/* Add Tier Modal */}
      {isAddModalOpen && (
        <Modal
          isOpen={isAddModalOpen}
          onClose={closeTierModal}
          title={editingTierId ? 'Edit Bulk Pricing Tier' : 'Create Bulk Pricing Tier'}
          subtitle="Quantity band and the price the phone uses for that band"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={closeTierModal}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleCreateTier}>
                {editingTierId ? 'Save Tier' : 'Create Tier'}
              </Button>
            </>
          }
        >
          <form onSubmit={handleCreateTier} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={styles.label}>Select Product</label>
              <select
                value={newTier.productId}
                onChange={(e) => {
                  const p = products.find((pr) => String(pr.id) === e.target.value);
                  setNewTier({
                    ...newTier,
                    productId: e.target.value,
                    productName: p?.name || '',
                  });
                }}
                style={styles.select}
              >
                {(products.some((p) => String(p.id) === String(newTier.productId))
                  ? products
                  : [{ id: newTier.productId, name: newTier.productName || `Product ${newTier.productId}` }, ...products]
                ).map((p) => (
                  <option key={p.id} value={String(p.id)} style={{ background: 'var(--bg-surface)' }}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={styles.label}>Min Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={newTier.minQty}
                  onChange={(e) => setNewTier({ ...newTier, minQty: Number(e.target.value) })}
                  style={styles.input}
                />
              </div>
              <div>
                <label style={styles.label}>Max Quantity (Optional)</label>
                <input
                  type="number"
                  placeholder="Leave empty for unlimited"
                  value={newTier.maxQty || ''}
                  onChange={(e) =>
                    setNewTier({
                      ...newTier,
                      maxQty: e.target.value ? Number(e.target.value) : undefined as any,
                    })
                  }
                  style={styles.input}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={styles.label}>Discount type</label>
                <select
                  value={newTier.discountType}
                  onChange={(e) =>
                    setNewTier({
                      ...newTier,
                      discountType: e.target.value === 'fixed_price' ? 'fixed_price' : 'percentage',
                    })
                  }
                  style={styles.select}
                >
                  <option value="percentage" style={{ background: 'var(--bg-surface)' }}>
                    Percent off
                  </option>
                  <option value="fixed_price" style={{ background: 'var(--bg-surface)' }}>
                    Fixed unit price (₹)
                  </option>
                </select>
              </div>
              <div>
                <label style={styles.label}>
                  {newTier.discountType === 'fixed_price' ? 'Unit price (₹)' : 'Discount (%)'}
                </label>
                <input
                  type="number"
                  min="0"
                  max={newTier.discountType === 'fixed_price' ? undefined : 90}
                  value={newTier.discountValue}
                  onChange={(e) => setNewTier({ ...newTier, discountValue: Number(e.target.value) })}
                  style={styles.input}
                />
              </div>
            </div>

            <div>
              <label style={styles.label}>Terms / Qualification Note</label>
              <input
                type="text"
                value={newTier.terms}
                onChange={(e) => setNewTier({ ...newTier, terms: e.target.value })}
                style={styles.input}
                placeholder="e.g. Valid for verified GST trade contractors"
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  label: {
    display: 'block',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: '6px',
  },
  select: {
    width: '100%',
    background: 'var(--tint-2)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: '9px 12px',
    color: 'var(--text-main)',
    fontSize: '0.86rem',
    outline: 'none',
    cursor: 'pointer',
  },
  input: {
    width: '100%',
    background: 'var(--tint-2)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: '9px 14px',
    color: 'var(--text-main)',
    fontSize: '0.86rem',
    outline: 'none',
  },
};
