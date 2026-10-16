import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Calculator,
  TrendingDown,
  CheckCircle,
  X,
} from 'lucide-react';
import type { BulkPriceTier, Product } from '../types';

interface BulkPricingManagerProps {
  tiers: BulkPriceTier[];
  products: Product[];
  onAddTier: (tier: BulkPriceTier) => void;
  onDeleteTier: (id: string) => void;
}

export const BulkPricingManager: React.FC<BulkPricingManagerProps> = ({
  tiers,
  products,
  onAddTier,
  onDeleteTier,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const [calcQuantity, setCalcQuantity] = useState<number>(55);

  // New tier form state
  const [newTier, setNewTier] = useState<BulkPriceTier>({
    id: `tier-${Date.now()}`,
    productId: products[0]?.id || '',
    productName: products[0]?.name || '',
    minQty: 10,
    maxQty: 49,
    discountType: 'percentage',
    discountValue: 5,
    terms: 'Valid on single site delivery order',
  });

  const selectedProduct = products.find((p) => p.id === selectedProductId) || products[0];

  // Calculate pricing simulation
  const applicableTiers = tiers
    .filter((t) => t.productId === selectedProductId)
    .sort((a, b) => b.minQty - a.minQty);

  const matchedTier = applicableTiers.find((t) => {
    if (calcQuantity < t.minQty) return false;
    if (t.maxQty && calcQuantity > t.maxQty) return false;
    return true;
  });

  const regularTotal = (selectedProduct?.price || 0) * calcQuantity;
  let discountedTotal = regularTotal;
  let savings = 0;
  let effectiveUnitPrice = selectedProduct?.price || 0;

  if (matchedTier) {
    if (matchedTier.discountType === 'percentage') {
      savings = (regularTotal * matchedTier.discountValue) / 100;
      discountedTotal = regularTotal - savings;
      effectiveUnitPrice = discountedTotal / calcQuantity;
    }
  }

  const handleOpenAdd = () => {
    setNewTier({
      id: `tier-${Date.now()}`,
      productId: products[0]?.id || '',
      productName: products[0]?.name || '',
      minQty: 20,
      maxQty: undefined,
      discountType: 'percentage',
      discountValue: 6,
      terms: 'Contractor site bulk tier',
    });
    setIsAddModalOpen(true);
  };

  const handleSaveTier = (e: React.FormEvent) => {
    e.preventDefault();
    const prod = products.find((p) => p.id === newTier.productId);
    const tierToSave: BulkPriceTier = {
      ...newTier,
      productName: prod?.name || newTier.productName,
    };
    onAddTier(tierToSave);
    setIsAddModalOpen(false);
  };

  return (
    <div style={styles.container}>
      {/* Top Split: Active Tiers Table & Interactive Calculator */}
      <div style={styles.splitGrid}>
        {/* Left: Active Tiers */}
        <div style={styles.leftCol}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.heading}>Active Bulk Discount Tiers</h2>
              <p style={styles.subheading}>
                Volume-based price rules configured for contractor & wholesale checkout
              </p>
            </div>
            <button onClick={handleOpenAdd} style={styles.addBtn} className="btn btn-primary">
              <Plus size={16} />
              <span>Create Bulk Tier</span>
            </button>
          </div>

          <div style={styles.tableCard}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.theadRow}>
                  <th style={styles.th}>Material / SKU</th>
                  <th style={styles.th}>Min - Max Qty</th>
                  <th style={styles.th}>Discount</th>
                  <th style={styles.th}>Terms & Conditions</th>
                  <th style={styles.thRight}>Action</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((tier) => (
                  <tr key={tier.id} style={styles.tbodyRow}>
                    <td style={styles.td}>
                      <span style={styles.tierProductName}>{tier.productName}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.qtyBadge}>
                        {tier.minQty} {tier.maxQty ? `– ${tier.maxQty}` : '+ units'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.discountPill}>
                        <TrendingDown size={13} />
                        <span>{tier.discountValue}% OFF</span>
                      </span>
                    </td>
                    <td style={styles.tdTerms}>{tier.terms}</td>
                    <td style={styles.tdRight}>
                      <button
                        onClick={() => onDeleteTier(tier.id)}
                        style={styles.deleteBtn}
                        title="Delete Tier"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Interactive Volume Calculator Simulator */}
        <div style={styles.calculatorCard}>
          <div style={styles.calcHeader}>
            <Calculator size={18} color="var(--brand-orange)" />
            <h3 style={styles.calcTitle}>Contractor Price Simulator</h3>
          </div>
          <p style={styles.calcSub}>
            Verify discount tier precedence and customer checkout invoice calculations
          </p>

          <div style={styles.calcForm}>
            {/* Product Selector */}
            <div style={styles.calcGroup}>
              <label style={styles.calcLabel}>Select Construction Material</label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                style={styles.calcSelect}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Base: ₹{p.price}/{p.unit})
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity Slider & Input */}
            <div style={styles.calcGroup}>
              <div style={styles.calcLabelRow}>
                <label style={styles.calcLabel}>Order Quantity</label>
                <span style={styles.qtyDisplay}>
                  {calcQuantity} {selectedProduct?.unit}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="200"
                value={calcQuantity}
                onChange={(e) => setCalcQuantity(Number(e.target.value))}
                style={styles.slider}
              />
            </div>

            {/* Live Calculation Breakdown */}
            <div style={styles.calculationBreakdown}>
              <div style={styles.breakdownRow}>
                <span style={styles.breakdownLabel}>Standard Retail Rate:</span>
                <span style={styles.breakdownValue}>₹{selectedProduct?.price} / unit</span>
              </div>

              <div style={styles.breakdownRow}>
                <span style={styles.breakdownLabel}>Gross Subtotal:</span>
                <span style={styles.breakdownValue}>₹{regularTotal.toLocaleString('en-IN')}</span>
              </div>

              <div style={styles.breakdownRow}>
                <span style={styles.breakdownLabel}>Matched Tier:</span>
                {matchedTier ? (
                  <span style={styles.matchedTierPill}>
                    <CheckCircle size={12} color="#10b981" />
                    <span>{matchedTier.discountValue}% Bulk Savings</span>
                  </span>
                ) : (
                  <span style={styles.noTierPill}>No tier (Regular Price)</span>
                )}
              </div>

              {savings > 0 && (
                <div style={styles.savingsRow}>
                  <span>Total Contractor Savings:</span>
                  <span style={styles.savingsValue}>- ₹{savings.toLocaleString('en-IN')}</span>
                </div>
              )}

              <div style={styles.totalRow}>
                <div>
                  <div style={styles.totalLabel}>Final Invoice Amount</div>
                  <div style={styles.effectiveRate}>
                    Effective: ₹{effectiveUnitPrice.toFixed(2)} / unit
                  </div>
                </div>
                <div style={styles.totalAmount}>
                  ₹{Math.round(discountedTotal).toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Bulk Tier Modal */}
      {isAddModalOpen && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalBox}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Create Bulk Price Rule</h2>
              <button onClick={() => setIsAddModalOpen(false)} style={styles.closeBtn}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTier} style={styles.modalForm}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Select Product SKU *</label>
                <select
                  value={newTier.productId}
                  onChange={(e) => setNewTier({ ...newTier, productId: e.target.value })}
                  style={styles.select}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Minimum Order Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    value={newTier.minQty}
                    onChange={(e) => setNewTier({ ...newTier, minQty: Number(e.target.value) })}
                    required
                    style={styles.input}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Maximum Quantity (Optional)</label>
                  <input
                    type="number"
                    value={newTier.maxQty || ''}
                    onChange={(e) =>
                      setNewTier({
                        ...newTier,
                        maxQty: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    placeholder="Leave empty for unlimited"
                    style={styles.input}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Discount Percentage (%) *</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={newTier.discountValue}
                    onChange={(e) =>
                      setNewTier({ ...newTier, discountValue: Number(e.target.value) })
                    }
                    required
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Applicable Terms & Dispatch Note</label>
                <input
                  type="text"
                  value={newTier.terms}
                  onChange={(e) => setNewTier({ ...newTier, terms: e.target.value })}
                  style={styles.input}
                  placeholder="e.g. Free site unloading with boom crane for orders over 100 bags"
                />
              </div>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  style={styles.cancelBtn}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Tier Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  splitGrid: {
    display: 'grid',
    gridTemplateColumns: '1.4fr 1fr',
    gap: '24px',
    alignItems: 'start',
  },
  leftCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
  },
  heading: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: '#fff',
  },
  subheading: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  tableCard: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  theadRow: {
    background: 'var(--bg-surface-elevated)',
    borderBottom: '1px solid var(--border-subtle)',
  },
  th: {
    padding: '12px 16px',
    fontSize: '0.74rem',
    fontWeight: 700,
    color: 'var(--text-dim)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  thRight: {
    padding: '12px 16px',
    fontSize: '0.74rem',
    fontWeight: 700,
    color: 'var(--text-dim)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    textAlign: 'right',
  },
  tbodyRow: {
    borderBottom: '1px solid var(--border-subtle)',
  },
  td: {
    padding: '14px 16px',
    fontSize: '0.84rem',
    color: 'var(--text-main)',
  },
  tdTerms: {
    padding: '14px 16px',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    maxWidth: '220px',
  },
  tdRight: {
    padding: '14px 16px',
    textAlign: 'right',
  },
  tierProductName: {
    fontWeight: 600,
    color: '#fff',
  },
  qtyBadge: {
    background: 'rgba(255,255,255,0.06)',
    padding: '4px 8px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.76rem',
    fontWeight: 600,
    color: 'var(--text-main)',
  },
  discountPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    borderRadius: 'var(--radius-full)',
    background: 'rgba(16, 185, 129, 0.12)',
    color: '#34d399',
    fontWeight: 700,
    fontSize: '0.76rem',
  },
  deleteBtn: {
    width: '30px',
    height: '30px',
    borderRadius: 'var(--radius-sm)',
    background: 'rgba(244, 63, 94, 0.12)',
    color: '#fb7185',
    border: '1px solid rgba(244, 63, 94, 0.2)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  calculatorCard: {
    background: 'var(--bg-surface)',
    border: '1px solid rgba(249, 115, 22, 0.25)',
    borderRadius: 'var(--radius-xl)',
    padding: '24px',
    boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
  },
  calcHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  calcTitle: {
    fontSize: '1.05rem',
    fontWeight: 700,
    color: '#fff',
  },
  calcSub: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    marginTop: '4px',
    marginBottom: '20px',
  },
  calcForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  calcGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  calcLabelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calcLabel: {
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
  qtyDisplay: {
    fontSize: '0.85rem',
    fontWeight: 700,
    color: 'var(--brand-orange)',
  },
  calcSelect: {
    background: 'var(--bg-app)',
    border: '1px solid var(--border-medium)',
    borderRadius: 'var(--radius-md)',
    padding: '9px 12px',
    color: '#fff',
    outline: 'none',
  },
  slider: {
    accentColor: 'var(--brand-orange)',
    cursor: 'pointer',
    width: '100%',
  },
  calculationBreakdown: {
    background: 'var(--bg-app)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginTop: '6px',
  },
  breakdownRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.8rem',
  },
  breakdownLabel: {
    color: 'var(--text-muted)',
  },
  breakdownValue: {
    fontWeight: 600,
    color: '#fff',
  },
  matchedTierPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    color: '#10b981',
    fontWeight: 700,
    fontSize: '0.78rem',
  },
  noTierPill: {
    color: 'var(--text-dim)',
    fontSize: '0.74rem',
  },
  savingsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 10px',
    background: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 'var(--radius-sm)',
    color: '#34d399',
    fontWeight: 700,
    fontSize: '0.82rem',
  },
  savingsValue: {
    fontSize: '0.88rem',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '10px',
    borderTop: '1px solid var(--border-subtle)',
    marginTop: '4px',
  },
  totalLabel: {
    fontSize: '0.82rem',
    fontWeight: 700,
    color: '#fff',
  },
  effectiveRate: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
  },
  totalAmount: {
    fontFamily: 'var(--font-display)',
    fontSize: '1.4rem',
    fontWeight: 800,
    color: 'var(--brand-orange)',
  },
  modalBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: '20px',
  },
  modalBox: {
    background: '#131b2e',
    border: '1px solid var(--border-medium)',
    borderRadius: 'var(--radius-xl)',
    width: '100%',
    maxWidth: '520px',
    boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
  },
  modalHeader: {
    padding: '18px 24px',
    borderBottom: '1px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: '1.15rem',
    fontWeight: 700,
    color: '#fff',
  },
  closeBtn: {
    color: 'var(--text-muted)',
    cursor: 'pointer',
  },
  modalForm: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '12px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
  input: {
    background: 'var(--bg-app)',
    border: '1px solid var(--border-medium)',
    borderRadius: 'var(--radius-md)',
    padding: '9px 12px',
    color: '#fff',
    outline: 'none',
  },
  select: {
    background: 'var(--bg-app)',
    border: '1px solid var(--border-medium)',
    borderRadius: 'var(--radius-md)',
    padding: '9px 12px',
    color: '#fff',
    outline: 'none',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    paddingTop: '16px',
    borderTop: '1px solid var(--border-subtle)',
  },
  cancelBtn: {
    padding: '8px 16px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-surface-elevated)',
    color: 'var(--text-muted)',
    border: '1px solid var(--border-subtle)',
    cursor: 'pointer',
  },
};
