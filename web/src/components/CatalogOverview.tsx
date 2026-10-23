import React, { useCallback, useEffect, useState } from 'react';
import {
  Package,
  Boxes,
  CheckCircle2,
  Edit2,
  Sparkles,
  Plus,
  Trash2,
} from 'lucide-react';
import type { Product, Category } from '../types';
import { DataTable, StatGrid, Badge, Button, Modal } from './ui';
import type { Column, StatItem } from './ui';
import { api } from '../services/api';

export type NewProductInput = {
  name: string;
  categoryId: string;
  price: number;
  unit: string;
  stockQuantity: number;
  description: string;
  sku?: string;
  brandName?: string;
};

const PAGE_SIZE = 50;

interface CatalogOverviewProps {
  /** Seed / fallback rows until first server page loads */
  products: Product[];
  catalogTotal?: number;
  onCatalogTotalChange?: (total: number) => void;
  categories: Category[];
  onUpdateProduct: (product: Product) => void;
  onCreateProduct: (product: NewProductInput) => Promise<void> | void;
  onDeleteProduct: (id: string) => Promise<void> | void;
  canEdit?: boolean;
  canDelete?: boolean;
}

const emptyCreateForm = (categories: Category[]): NewProductInput => ({
  name: '',
  categoryId: categories[0] ? String(categories[0].id) : '',
  price: 0,
  unit: '1 unit',
  stockQuantity: 100,
  description: '',
  sku: '',
  brandName: '',
});

export const CatalogOverview: React.FC<CatalogOverviewProps> = ({
  products: seedProducts,
  catalogTotal: seedTotal,
  onCatalogTotalChange,
  categories,
  onUpdateProduct,
  onCreateProduct,
  onDeleteProduct,
  canEdit = true,
  canDelete = true,
}) => {
  const [rows, setRows] = useState<Product[]>(seedProducts);
  const [total, setTotal] = useState(seedTotal || seedProducts.length);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [listLoading, setListLoading] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<NewProductInput>(() => emptyCreateForm(categories));
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const loadPage = useCallback(async () => {
    try {
      setListLoading(true);
      const result = await api.getProducts({
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch || undefined,
        categoryId: selectedCategory === 'all' ? undefined : selectedCategory,
      });
      setRows(result.products as Product[]);
      setTotal(result.meta.total);
      setTotalPages(Math.max(1, result.meta.totalPages));
      onCatalogTotalChange?.(result.meta.total);
    } catch (err) {
      console.warn('Catalogue page load failed', err);
    } finally {
      setListLoading(false);
    }
  }, [page, debouncedSearch, selectedCategory, onCatalogTotalChange]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedCategory]);

  const inStockCount = rows.filter((p) => p.stockStatus === 'in_stock').length;
  const featuredCount = rows.filter((p) => p.featured).length;

  const stats: StatItem[] = [
    {
      label: 'Active Catalogue SKUs',
      value: total >= 1000 ? `${(total / 1000).toFixed(total >= 10000 ? 0 : 1)}k`.replace(/\.0k$/, 'k') : total,
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
      label: 'In-Stock (this page)',
      value: `${rows.length > 0 ? Math.round((inStockCount / rows.length) * 100) : 0}%`,
      icon: <CheckCircle2 size={20} />,
      iconColor: '#10b981',
    },
    {
      label: 'Featured (this page)',
      value: featuredCount,
      icon: <Sparkles size={20} />,
      iconColor: '#a855f7',
    },
  ];

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      onUpdateProduct(editingProduct);
      setEditingProduct(null);
      loadPage();
    }
  };

  const openCreate = () => {
    setCreateForm(emptyCreateForm(categories));
    setIsCreateOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim() || !createForm.categoryId || createForm.price < 0) return;
    try {
      setSaving(true);
      await onCreateProduct({
        ...createForm,
        name: createForm.name.trim(),
        sku: createForm.sku?.trim() || undefined,
        brandName: createForm.brandName?.trim() || undefined,
      });
      setIsCreateOpen(false);
      setPage(1);
      await loadPage();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product: Product) => {
    const ok = window.confirm(`Remove "${product.name}" from the catalogue? (soft-delete on server)`);
    if (!ok) return;
    try {
      setDeletingId(product.id);
      await onDeleteProduct(product.id);
      await loadPage();
    } finally {
      setDeletingId(null);
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
          <Badge variant="neutral">{cat?.name || p.categoryName || 'General Materials'}</Badge>
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
          {p.price == null ? (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>No price</div>
          ) : (
            <div style={{ fontWeight: 700, color: '#10b981', fontFamily: 'monospace', fontSize: '0.94rem' }}>
              ₹{Number(p.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          )}
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
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{p.unit || 'unit'}</span>
      ),
    },
    {
      key: 'stockStatus',
      header: 'STOCK LEVEL',
      align: 'center',
      render: (p) => (
        <Badge variant={p.stockStatus === 'in_stock' ? 'success' : 'danger'} dot>
          {p.stockQuantity !== undefined
            ? `${p.stockQuantity} in stock`
            : p.stockStatus === 'in_stock'
              ? 'In Stock'
              : 'Out of Stock'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (p) => (
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
          {canEdit ? (
            <Button variant="ghost" size="sm" icon={<Edit2 size={14} />} onClick={() => setEditingProduct({ ...p })}>
              Edit
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 size={14} />}
              disabled={deletingId === p.id}
              onClick={() => handleDelete(p)}
            >
              {deletingId === p.id ? '…' : 'Delete'}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <StatGrid items={stats} />

      <DataTable<Product>
        data={rows}
        columns={columns}
        keyExtractor={(p) => p.id}
        searchPlaceholder="Search MySQL catalogue by title, SKU or brand…"
        loading={listLoading}
        emptyTitle="No products on this page"
        emptyDescription="Try another search, category, or page."
        serverList={{
          search,
          onSearchChange: setSearch,
          page,
          totalPages,
          total,
          pageSize: PAGE_SIZE,
          onPageChange: setPage,
        }}
        extraControls={
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
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
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
            {canEdit ? (
              <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={openCreate}>
                Add Product
              </Button>
            ) : null}
          </div>
        }
      />

      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add Catalogue Product"
        subtitle="Creates a SKU via POST /catalog/products (served to the mobile app)"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={saving || !createForm.name.trim() || !createForm.categoryId}
              onClick={handleCreate}
            >
              {saving ? 'Creating…' : 'Create Product'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} style={modalStyles.form}>
          <div>
            <label style={modalStyles.label}>Product Name</label>
            <input
              type="text"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              style={modalStyles.input}
              placeholder="e.g. UltraTech OPC 53 Grade Cement 50kg"
              required
            />
          </div>
          <div>
            <label style={modalStyles.label}>Category</label>
            <select
              value={createForm.categoryId}
              onChange={(e) => setCreateForm({ ...createForm, categoryId: e.target.value })}
              style={modalStyles.input}
              required
            >
              {categories.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div style={modalStyles.row}>
            <div style={{ flex: 1 }}>
              <label style={modalStyles.label}>Price (₹)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={createForm.price}
                onChange={(e) => setCreateForm({ ...createForm, price: Number(e.target.value) })}
                style={modalStyles.input}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={modalStyles.label}>Stock Qty</label>
              <input
                type="number"
                min={0}
                value={createForm.stockQuantity}
                onChange={(e) => setCreateForm({ ...createForm, stockQuantity: Number(e.target.value) })}
                style={modalStyles.input}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={modalStyles.label}>Unit</label>
              <input
                type="text"
                value={createForm.unit}
                onChange={(e) => setCreateForm({ ...createForm, unit: e.target.value })}
                style={modalStyles.input}
                placeholder="50 kg bag"
              />
            </div>
          </div>
          <div>
            <label style={modalStyles.label}>Brand</label>
            <input
              type="text"
              value={createForm.brandName || ''}
              onChange={(e) => setCreateForm({ ...createForm, brandName: e.target.value })}
              style={modalStyles.input}
              placeholder="e.g. UltraTech"
            />
          </div>
          <div>
            <label style={modalStyles.label}>Description</label>
            <textarea
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              style={{ ...modalStyles.input, minHeight: 72, resize: 'vertical' }}
            />
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!editingProduct}
        onClose={() => setEditingProduct(null)}
        title="Edit Product"
        subtitle={editingProduct?.sku || editingProduct?.id}
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
        {editingProduct && (
          <form onSubmit={handleSaveEdit} style={modalStyles.form}>
            <div>
              <label style={modalStyles.label}>Name</label>
              <input
                type="text"
                value={editingProduct.name}
                onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                style={modalStyles.input}
              />
            </div>
            <div style={modalStyles.row}>
              <div style={{ flex: 1 }}>
                <label style={modalStyles.label}>Price (₹)</label>
                <input
                  type="number"
                  value={editingProduct.price ?? ''}
                  placeholder="No price yet"
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, price: e.target.value === '' ? null : Number(e.target.value) })
                  }
                  style={modalStyles.input}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={modalStyles.label}>Stock Qty</label>
                <input
                  type="number"
                  value={editingProduct.stockQuantity ?? 0}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, stockQuantity: Number(e.target.value) })
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
            <div>
              <label style={modalStyles.label}>Brand</label>
              <input
                type="text"
                value={editingProduct.brandName || ''}
                onChange={(e) => setEditingProduct({ ...editingProduct, brandName: e.target.value })}
                style={modalStyles.input}
              />
            </div>
            <div>
              <label style={modalStyles.label}>Description</label>
              <textarea
                value={editingProduct.description || ''}
                onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                style={{ ...modalStyles.input, minHeight: 72, resize: 'vertical' }}
              />
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

const modalStyles: Record<string, React.CSSProperties> = {
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  label: {
    display: 'block',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginBottom: 6,
    fontWeight: 600,
  },
  input: {
    width: '100%',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: '10px 12px',
    color: '#fff',
    fontSize: '0.9rem',
    outline: 'none',
    boxSizing: 'border-box',
  },
  row: { display: 'flex', gap: 12 },
};
