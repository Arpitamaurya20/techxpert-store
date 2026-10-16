import React, { useState } from 'react';
import {
  Search,
  Filter,
  Edit,
  CheckCircle,
  AlertTriangle,
  XCircle,
  X,
  Check,
} from 'lucide-react';
import type { Product, Category } from '../types';

interface CatalogOverviewProps {
  products: Product[];
  categories: Category[];
  onUpdateProduct: (product: Product) => void;
}

export const CatalogOverview: React.FC<CatalogOverviewProps> = ({
  products,
  categories,
  onUpdateProduct,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.categoryId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' || p.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleOpenEdit = (p: Product) => {
    setEditingProduct({ ...p });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      onUpdateProduct(editingProduct);
      setEditingProduct(null);
    }
  };

  return (
    <div style={styles.container}>
      {/* Top Filter & Search Bar */}
      <div style={styles.filterBar}>
        <div style={styles.searchBox}>
          <Search size={16} color="var(--text-dim)" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search material SKU, brand or name..."
            style={styles.searchInput}
          />
        </div>

        <div style={styles.categorySelectWrap}>
          <Filter size={15} color="var(--text-muted)" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={styles.categorySelect}
          >
            <option value="all">All Categories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Catalog Table */}
      <div style={styles.tableCard}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.theadRow}>
              <th style={styles.th}>Material Name</th>
              <th style={styles.th}>Category</th>
              <th style={styles.th}>Unit / Pack</th>
              <th style={styles.th}>Base Price</th>
              <th style={styles.th}>Inventory</th>
              <th style={styles.th}>Stock Status</th>
              <th style={styles.thRight}>Edit</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((p) => {
              const categoryObj = categories.find((c) => c.id === p.categoryId);
              return (
                <tr key={p.id} style={styles.tbodyRow}>
                  <td style={styles.td}>
                    <div style={styles.productCell}>
                      <span style={styles.productName}>{p.name}</span>
                      {p.featured && <span style={styles.featuredBadge}>Featured</span>}
                    </div>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.categoryPill}>
                      {categoryObj ? categoryObj.name : p.categoryId}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.unitText}>{p.unit}</span>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.priceText}>₹{p.price}</span>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.stockCount}>{p.stockQuantity} units</span>
                  </td>
                  <td style={styles.td}>
                    {p.stockStatus === 'in_stock' && (
                      <span className="badge badge-published">
                        <CheckCircle size={11} />
                        <span>In Stock</span>
                      </span>
                    )}
                    {p.stockStatus === 'low_stock' && (
                      <span className="badge badge-paused">
                        <AlertTriangle size={11} />
                        <span>Low Stock</span>
                      </span>
                    )}
                    {p.stockStatus === 'out_of_stock' && (
                      <span className="badge badge-archived">
                        <XCircle size={11} />
                        <span>Out of Stock</span>
                      </span>
                    )}
                  </td>
                  <td style={styles.tdRight}>
                    <button
                      onClick={() => handleOpenEdit(p)}
                      style={styles.editBtn}
                      title="Adjust Price & Stock"
                    >
                      <Edit size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Edit Product Price & Stock Modal */}
      {editingProduct && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalBox}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Adjust Price & Inventory</h2>
              <button onClick={() => setEditingProduct(null)} style={styles.closeBtn}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={styles.modalForm}>
              <div style={styles.productBrief}>
                <h3 style={styles.briefName}>{editingProduct.name}</h3>
                <span style={styles.briefCategory}>{editingProduct.categoryId}</span>
              </div>

              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Base Price (₹ INR) *</label>
                  <input
                    type="number"
                    min="1"
                    value={editingProduct.price}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, price: Number(e.target.value) })
                    }
                    required
                    style={styles.input}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>On-Hand Stock Units *</label>
                  <input
                    type="number"
                    min="0"
                    value={editingProduct.stockQuantity}
                    onChange={(e) => {
                      const qty = Number(e.target.value);
                      let status: Product['stockStatus'] = 'in_stock';
                      if (qty === 0) status = 'out_of_stock';
                      else if (qty < 15) status = 'low_stock';
                      setEditingProduct({
                        ...editingProduct,
                        stockQuantity: qty,
                        stockStatus: status,
                      });
                    }}
                    required
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Stock Status Flag</label>
                <select
                  value={editingProduct.stockStatus}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      stockStatus: e.target.value as Product['stockStatus'],
                    })
                  }
                  style={styles.select}
                >
                  <option value="in_stock">In Stock (Available for Delivery)</option>
                  <option value="low_stock">Low Stock (Show urgency in app)</option>
                  <option value="out_of_stock">Out of Stock (Disable Add to Cart)</option>
                </select>
              </div>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  style={styles.cancelBtn}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <Check size={16} />
                  <span>Update SKU</span>
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
    gap: '20px',
  },
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-medium)',
    borderRadius: 'var(--radius-md)',
    padding: '8px 14px',
    width: '360px',
  },
  searchInput: {
    background: 'transparent',
    border: 'none',
    color: '#fff',
    outline: 'none',
    width: '100%',
    fontSize: '0.85rem',
  },
  categorySelectWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-medium)',
    borderRadius: 'var(--radius-md)',
    padding: '4px 12px',
  },
  categorySelect: {
    background: 'transparent',
    border: 'none',
    color: '#fff',
    outline: 'none',
    fontSize: '0.82rem',
    cursor: 'pointer',
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
  tdRight: {
    padding: '14px 16px',
    textAlign: 'right',
  },
  productCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  productName: {
    fontWeight: 600,
    color: '#fff',
  },
  featuredBadge: {
    fontSize: '0.62rem',
    fontWeight: 700,
    color: 'var(--brand-orange)',
    background: 'var(--brand-orange-light)',
    padding: '2px 6px',
    borderRadius: 'var(--radius-full)',
  },
  categoryPill: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    background: 'rgba(255,255,255,0.04)',
    padding: '3px 8px',
    borderRadius: 'var(--radius-sm)',
  },
  unitText: {
    color: 'var(--text-dim)',
    fontSize: '0.78rem',
  },
  priceText: {
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    color: '#fff',
  },
  stockCount: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
  },
  editBtn: {
    width: '30px',
    height: '30px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-surface-elevated)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-muted)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
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
    maxWidth: '480px',
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
  productBrief: {
    background: 'rgba(255,255,255,0.03)',
    padding: '12px 14px',
    borderRadius: 'var(--radius-md)',
  },
  briefName: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: '#fff',
  },
  briefCategory: {
    fontSize: '0.74rem',
    color: 'var(--brand-orange)',
    textTransform: 'uppercase',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
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
