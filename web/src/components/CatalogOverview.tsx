import React, { useState } from 'react';
import {
  Package,
  Boxes,
  CheckCircle2,
  Edit2,
  Sparkles,
} from 'lucide-react';
import type { Product, Category } from '../types';
import { DataTable, StatGrid, Badge, Button, Modal } from './ui';
import type { Column, StatItem } from './ui';


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
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const totalSKUs = products.length;
  const inStockCount = products.filter((p) => p.stockStatus === 'in_stock').length;
  const featuredCount = products.filter((p) => p.featured).length;

  const stats: StatItem[] = [
    {
      label: 'Active Catalogue SKUs',
      value: totalSKUs > 100 ? '103k+' : totalSKUs,
      icon: <Package size={20} />,
      iconColor: '#38bdf8',
    },
    {
      label: 'Trade Categories',
      value: categories.length,
      icon: <Boxes size={20} />,
      iconColor: 'var(--brand-orange)',
    },
    {
      label: 'In-Stock Availability',
      value: `${products.length > 0 ? Math.round((inStockCount / products.length) * 100) : 100}%`,
      icon: <CheckCircle2 size={20} />,
      iconColor: '#10b981',
    },
    {
      label: 'Featured Promotions',
      value: featuredCount,
      icon: <Sparkles size={20} />,
      iconColor: '#a855f7',
    },
  ];

  const filteredProducts = selectedCategory === 'all'
    ? products
    : products.filter((p) => String(p.categoryId) === selectedCategory);

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      onUpdateProduct(editingProduct);
      setEditingProduct(null);
    }
  };

  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: 'MATERIAL / SKU',
      sortable: true,
      render: (p) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-sm)',
              background: '#1e293b',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {p.imageUrl ? (
              <img
                src={p.imageUrl}
                alt={p.name}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <Package size={18} color="var(--text-dim)" />
            )}
          </div>
          <div>
            <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.88rem' }}>{p.name}</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '2px' }}>
              SKU: <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>{p.sku || p.id}</span>
              {p.brandName && ` • Brand: ${p.brandName}`}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'categoryName',
      header: 'CATEGORY',
      render: (p) => {
        const cat = categories.find((c) => String(c.id) === String(p.categoryId));
        return (
          <Badge variant="neutral">
            {cat?.name || p.categoryName || 'General Materials'}
          </Badge>
        );
      },
    },
    {
      key: 'price',
      header: 'BASE PRICE',
      sortable: true,
      align: 'right',
      render: (p) => (
        <div>
          <div style={{ fontWeight: 700, color: '#10b981', fontFamily: 'monospace', fontSize: '0.94rem' }}>
            ₹{Number(p.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          {p.originalPrice && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textDecoration: 'line-through' }}>
              MRP ₹{Number(p.originalPrice).toLocaleString('en-IN')}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'unit',
      header: 'UNIT / PACKAGING',
      render: (p) => (
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {p.unit || 'unit'}
        </span>
      ),
    },
    {
      key: 'stockStatus',
      header: 'STOCK LEVEL',
      align: 'center',
      render: (p) => (
        <Badge
          variant={p.stockStatus === 'in_stock' ? 'success' : 'danger'}
          dot
        >
          {p.stockQuantity !== undefined ? `${p.stockQuantity} in stock` : p.stockStatus === 'in_stock' ? 'In Stock' : 'Out of Stock'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (p) => (
        <Button
          variant="ghost"
          size="sm"
          icon={<Edit2 size={14} />}
          onClick={() => setEditingProduct({ ...p })}
        >
          Edit
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Metric Cards */}
      <StatGrid items={stats} />

      {/* Main Table */}
      <DataTable<Product>
        data={filteredProducts}
        columns={columns}
        keyExtractor={(p) => p.id}
        searchPlaceholder="Search materials by title, SKU or brand..."
        searchKeys={['name', 'sku', 'brandName', 'description']}
        pageSize={12}
        extraControls={
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 12px',
              color: '#fff',
              fontSize: '0.84rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all">All Categories ({products.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
        }
      />

      {/* Edit Product Modal */}
      {editingProduct && (
        <Modal
          isOpen={Boolean(editingProduct)}
          onClose={() => setEditingProduct(null)}
          title={`Edit Material — ${editingProduct.name}`}
          subtitle={`SKU: ${editingProduct.sku || editingProduct.id}`}
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setEditingProduct(null)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveEdit}>
                Save Changes
              </Button>
            </>
          }
        >
          <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={modalStyles.label}>Product Name</label>
              <input
                type="text"
                value={editingProduct.name}
                onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                style={modalStyles.input}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={modalStyles.label}>Selling Price (₹)</label>
                <input
                  type="number"
                  value={editingProduct.price}
                  onChange={(e) => setEditingProduct({ ...editingProduct, price: Number(e.target.value) })}
                  style={modalStyles.input}
                />
              </div>
              <div>
                <label style={modalStyles.label}>Stock Quantity</label>
                <input
                  type="number"
                  value={editingProduct.stockQuantity || 100}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      stockQuantity: Number(e.target.value),
                      stockStatus: Number(e.target.value) > 0 ? 'in_stock' : 'out_of_stock',
                    })
                  }
                  style={modalStyles.input}
                />
              </div>
            </div>

            <div>
              <label style={modalStyles.label}>Packaging Unit</label>
              <input
                type="text"
                value={editingProduct.unit || ''}
                onChange={(e) => setEditingProduct({ ...editingProduct, unit: e.target.value })}
                style={modalStyles.input}
                placeholder="e.g. 50 kg bag, coil, meter"
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

const modalStyles: Record<string, React.CSSProperties> = {
  label: {
    display: 'block',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: '9px 14px',
    color: '#fff',
    fontSize: '0.88rem',
    outline: 'none',
  },
};
