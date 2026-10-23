import React, { useCallback, useEffect, useState } from 'react';
import {
  Boxes,
  FolderTree,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api';
import type { Category, Subcategory } from '../types';
import { Badge, Button, EmptyState, Modal, StatGrid, useToast } from './ui';
import type { StatItem } from './ui';

interface CategoryManagerProps {
  onHierarchyChanged?: () => void;
  onAudit?: (action: string, details: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

type CatForm = {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  displayOrder: number;
};

type SubForm = {
  name: string;
  slug: string;
  imageUrl: string;
  displayOrder: number;
};

const emptyCat = (): CatForm => ({
  name: '',
  slug: '',
  description: '',
  imageUrl: '',
  displayOrder: 100,
});

const emptySub = (): SubForm => ({
  name: '',
  slug: '',
  imageUrl: '',
  displayOrder: 100,
});

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({
  onHierarchyChanged,
  onAudit,
  canEdit = true,
  canDelete = true,
}) => {
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [subsLoading, setSubsLoading] = useState(false);

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catForm, setCatForm] = useState<CatForm>(emptyCat());
  const [savingCat, setSavingCat] = useState(false);

  const [subModalOpen, setSubModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subcategory | null>(null);
  const [subForm, setSubForm] = useState<SubForm>(emptySub());
  const [savingSub, setSavingSub] = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await api.getCategories();
      setCategories(rows || []);
      setSelectedId((prev) => {
        if (prev && (rows || []).some((c: Category) => String(c.id) === prev)) return prev;
        return rows?.[0] ? String(rows[0].id) : null;
      });
    } catch (err: any) {
      toast.error(`Couldn't load categories: ${err.message}`);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadSubs = useCallback(async (categoryId: string | null) => {
    if (!categoryId) {
      setSubcategories([]);
      return;
    }
    try {
      setSubsLoading(true);
      const rows = await api.getSubcategories(categoryId);
      setSubcategories(rows || []);
    } catch (err: any) {
      toast.error(`Couldn't load subcategories: ${err.message}`);
      setSubcategories([]);
    } finally {
      setSubsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadSubs(selectedId);
  }, [selectedId, loadSubs]);

  const selected = categories.find((c) => String(c.id) === selectedId) || null;

  const stats: StatItem[] = [
    {
      label: 'Trade Categories',
      value: categories.length,
      icon: <Boxes size={20} />,
      iconColor: 'var(--accent)',
    },
    {
      label: 'Subcategories (selected)',
      value: subcategories.length,
      icon: <FolderTree size={20} />,
      iconColor: 'var(--info)',
    },
  ];

  const openCreateCat = () => {
    setEditingCat(null);
    setCatForm(emptyCat());
    setCatModalOpen(true);
  };

  const openEditCat = (cat: Category) => {
    setEditingCat(cat);
    setCatForm({
      name: cat.name || '',
      slug: cat.slug || '',
      description: cat.description || '',
      imageUrl: cat.imageUrl || '',
      displayOrder: Number(cat.displayOrder ?? 100),
    });
    setCatModalOpen(true);
  };

  const saveCategory = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!catForm.name.trim()) return;
    try {
      setSavingCat(true);
      const payload = {
        name: catForm.name.trim(),
        slug: catForm.slug.trim() || slugify(catForm.name),
        description: catForm.description.trim(),
        imageUrl: catForm.imageUrl.trim(),
        displayOrder: Number(catForm.displayOrder) || 100,
      };
      if (editingCat) {
        await api.updateCategory(String(editingCat.id), payload);
        onAudit?.('Updated Category', `Updated "${payload.name}"`);
        toast.success(`Category "${payload.name}" saved.`);
      } else {
        const created = await api.createCategory(payload);
        onAudit?.('Created Category', `Added "${payload.name}"`);
        toast.success(`Category "${payload.name}" added.`);
        if (created?.id) setSelectedId(String(created.id));
      }
      setCatModalOpen(false);
      await loadCategories();
      onHierarchyChanged?.();
    } catch (err: any) {
      toast.error(`Couldn't save the category: ${err.message}`);
    } finally {
      setSavingCat(false);
    }
  };

  const deleteCategory = async (cat: Category) => {
    const ok = window.confirm(
      `Remove category "${cat.name}"? Subcategories under it will also be deactivated.`
    );
    if (!ok) return;
    try {
      await api.deleteCategory(String(cat.id));
      onAudit?.('Deleted Category', `Removed "${cat.name}"`);
      toast.success(`Category "${cat.name}" removed.`);
      await loadCategories();
      onHierarchyChanged?.();
    } catch (err: any) {
      toast.error(`Couldn't remove "${cat.name}": ${err.message}`);
    }
  };

  const openCreateSub = () => {
    if (!selectedId) return;
    setEditingSub(null);
    setSubForm(emptySub());
    setSubModalOpen(true);
  };

  const openEditSub = (sub: Subcategory) => {
    setEditingSub(sub);
    setSubForm({
      name: sub.name || '',
      slug: sub.slug || '',
      imageUrl: sub.imageUrl || '',
      displayOrder: Number(sub.displayOrder ?? 100),
    });
    setSubModalOpen(true);
  };

  const saveSubcategory = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!selectedId || !subForm.name.trim()) return;
    try {
      setSavingSub(true);
      const payload = {
        name: subForm.name.trim(),
        slug: subForm.slug.trim() || slugify(subForm.name),
        imageUrl: subForm.imageUrl.trim(),
        displayOrder: Number(subForm.displayOrder) || 100,
        categoryId: selectedId,
      };
      if (editingSub) {
        await api.updateSubcategory(String(editingSub.id), payload);
        onAudit?.('Updated Subcategory', `Updated "${payload.name}" under ${selected?.name}`);
        toast.success(`Subcategory "${payload.name}" saved.`);
      } else {
        await api.createSubcategory(payload);
        onAudit?.('Created Subcategory', `Added "${payload.name}" under ${selected?.name}`);
        toast.success(`Subcategory "${payload.name}" added under ${selected?.name}.`);
      }
      setSubModalOpen(false);
      await loadSubs(selectedId);
      onHierarchyChanged?.();
    } catch (err: any) {
      toast.error(`Couldn't save the subcategory: ${err.message}`);
    } finally {
      setSavingSub(false);
    }
  };

  const deleteSubcategory = async (sub: Subcategory) => {
    const ok = window.confirm(`Remove subcategory "${sub.name}"?`);
    if (!ok) return;
    try {
      await api.deleteSubcategory(String(sub.id));
      onAudit?.('Deleted Subcategory', `Removed "${sub.name}"`);
      toast.success(`Subcategory "${sub.name}" removed.`);
      await loadSubs(selectedId);
      onHierarchyChanged?.();
    } catch (err: any) {
      toast.error(`Couldn't remove "${sub.name}": ${err.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <StatGrid items={stats} />

      <div style={styles.toolbar}>
        <p style={styles.hint}>
          These categories and subcategories are what customers browse and filter by in the app.
        </p>
        <Button
          variant="secondary"
          size="sm"
          icon={<RefreshCw size={14} />}
          onClick={() => {
            loadCategories();
            loadSubs(selectedId);
          }}
          loading={loading}
        >
          Refresh
        </Button>
      </div>

      <div style={styles.split}>
        {/* Categories column */}
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <h3 style={styles.panelTitle}>Categories</h3>
            {canEdit ? (
              <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={openCreateCat}>
                Add
              </Button>
            ) : null}
          </div>

          {categories.length === 0 && !loading ? (
            <EmptyState
              title="No categories"
              description="Add a trade category (Cement, Paint, Tiles…) to start the hierarchy."
              actionLabel={canEdit ? 'Add Category' : undefined}
              onAction={canEdit ? openCreateCat : undefined}
            />
          ) : (
            <div style={styles.list}>
              {categories.map((cat) => {
                const active = String(cat.id) === selectedId;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedId(String(cat.id))}
                    style={{
                      ...styles.listItem,
                      ...(active ? styles.listItemActive : {}),
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <div style={styles.itemName}>{cat.name}</div>
                      <div style={styles.itemMeta}>
                        {cat.slug || cat.id}
                        {(cat.productCount ?? cat.activeProducts) !== undefined &&
                          ` · ${cat.productCount ?? cat.activeProducts} SKUs`}
                      </div>
                    </div>
                    <div style={styles.itemActions} onClick={(e) => e.stopPropagation()}>
                      {canEdit ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Edit2 size={13} />}
                          onClick={() => openEditCat(cat)}
                        />
                      ) : null}
                      {canDelete ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 size={13} color="var(--danger)" />}
                          onClick={() => deleteCategory(cat)}
                        />
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Subcategories column */}
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h3 style={styles.panelTitle}>Subcategories</h3>
              {selected && (
                <Badge variant="neutral">{selected.name}</Badge>
              )}
            </div>
            {canEdit ? (
              <Button
                variant="primary"
                size="sm"
                icon={<Plus size={14} />}
                onClick={openCreateSub}
                disabled={!selectedId}
              >
                Add
              </Button>
            ) : null}
          </div>

          {!selectedId ? (
            <EmptyState title="Select a category" description="Choose a category on the left to manage its subcategories." />
          ) : subsLoading ? (
            <p style={styles.loadingText}>Loading…</p>
          ) : subcategories.length === 0 ? (
            <EmptyState
              title="No subcategories"
              description={`Add subcategories under "${selected?.name}".`}
              actionLabel={canEdit ? 'Add Subcategory' : undefined}
              onAction={canEdit ? openCreateSub : undefined}
            />
          ) : (
            <div style={styles.list}>
              {subcategories.map((sub) => (
                <div key={sub.id} style={styles.subRow}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.itemName}>{sub.name}</div>
                    <div style={styles.itemMeta}>{sub.slug || sub.id}</div>
                  </div>
                  <div style={styles.itemActions}>
                    {canEdit ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Edit2 size={13} />}
                        onClick={() => openEditSub(sub)}
                      />
                    ) : null}
                    {canDelete ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Trash2 size={13} color="var(--danger)" />}
                        onClick={() => deleteSubcategory(sub)}
                      />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Category modal */}
      <Modal
        isOpen={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        title={editingCat ? 'Edit Category' : 'Add Category'}
        subtitle="Visible in the mobile Categories tab"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setCatModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={savingCat}
              disabled={!catForm.name.trim()}
              onClick={() => saveCategory()}
            >
              {editingCat ? 'Save Changes' : 'Create Category'}
            </Button>
          </>
        }
      >
        <form onSubmit={saveCategory} style={styles.form}>
          <div>
            <label style={styles.label}>Name *</label>
            <input
              style={styles.input}
              value={catForm.name}
              onChange={(e) => {
                const name = e.target.value;
                setCatForm((f) => ({
                  ...f,
                  name,
                  slug: f.slug && editingCat ? f.slug : slugify(name),
                }));
              }}
              required
              placeholder="e.g. Cement & Plaster"
            />
          </div>
          <div>
            <label style={styles.label}>Slug / code</label>
            <input
              style={styles.input}
              value={catForm.slug}
              onChange={(e) => setCatForm({ ...catForm, slug: e.target.value })}
              placeholder="cement-plaster"
            />
          </div>
          <div>
            <label style={styles.label}>Display order</label>
            <input
              type="number"
              style={styles.input}
              value={catForm.displayOrder}
              onChange={(e) => setCatForm({ ...catForm, displayOrder: Number(e.target.value) })}
            />
          </div>
          <div>
            <label style={styles.label}>Image URL</label>
            <input
              style={styles.input}
              value={catForm.imageUrl}
              onChange={(e) => setCatForm({ ...catForm, imageUrl: e.target.value })}
              placeholder="/images/subcategories/opc-cement.jpg"
            />
          </div>
          <div>
            <label style={styles.label}>Description</label>
            <textarea
              style={{ ...styles.input, minHeight: '72px', resize: 'vertical' }}
              value={catForm.description}
              onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      {/* Subcategory modal */}
      <Modal
        isOpen={subModalOpen}
        onClose={() => setSubModalOpen(false)}
        title={editingSub ? 'Edit Subcategory' : 'Add Subcategory'}
        subtitle={selected ? `Under ${selected.name}` : undefined}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setSubModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={savingSub}
              disabled={!subForm.name.trim()}
              onClick={() => saveSubcategory()}
            >
              {editingSub ? 'Save Changes' : 'Create Subcategory'}
            </Button>
          </>
        }
      >
        <form onSubmit={saveSubcategory} style={styles.form}>
          <div>
            <label style={styles.label}>Name *</label>
            <input
              style={styles.input}
              value={subForm.name}
              onChange={(e) => {
                const name = e.target.value;
                setSubForm((f) => ({
                  ...f,
                  name,
                  slug: f.slug && editingSub ? f.slug : slugify(name),
                }));
              }}
              required
              placeholder="e.g. OPC Cement"
            />
          </div>
          <div>
            <label style={styles.label}>Slug / code</label>
            <input
              style={styles.input}
              value={subForm.slug}
              onChange={(e) => setSubForm({ ...subForm, slug: e.target.value })}
            />
          </div>
          <div>
            <label style={styles.label}>Display order</label>
            <input
              type="number"
              style={styles.input}
              value={subForm.displayOrder}
              onChange={(e) => setSubForm({ ...subForm, displayOrder: Number(e.target.value) })}
            />
          </div>
          <div>
            <label style={styles.label}>Image URL</label>
            <input
              style={styles.input}
              value={subForm.imageUrl}
              onChange={(e) => setSubForm({ ...subForm, imageUrl: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  hint: {
    margin: 0,
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
    maxWidth: '640px',
    lineHeight: 1.45,
  },
  split: {
    display: 'grid',
    gridTemplateColumns: 'minmax(260px, 1fr) minmax(280px, 1.2fr)',
    gap: '16px',
  },
  panel: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    padding: '16px',
    minHeight: '360px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
  },
  panelTitle: {
    margin: 0,
    fontSize: '0.95rem',
    fontWeight: 700,
    color: 'var(--text-main)',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    overflowY: 'auto',
    maxHeight: '520px',
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid transparent',
    background: 'var(--tint-1)',
    cursor: 'pointer',
    color: 'inherit',
    width: '100%',
  },
  listItemActive: {
    background: 'var(--bg-surface-elevated)',
    borderColor: 'var(--accent-border)',
  },
  subRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--tint-1)',
    border: '1px solid var(--border-subtle)',
  },
  itemName: {
    fontSize: '0.88rem',
    fontWeight: 600,
    color: 'var(--text-main)',
  },
  itemMeta: {
    fontSize: '0.72rem',
    color: 'var(--text-dim)',
    marginTop: '2px',
    fontFamily: 'monospace',
  },
  itemActions: {
    display: 'flex',
    gap: '2px',
    flexShrink: 0,
  },
  loadingText: {
    color: 'var(--text-dim)',
    fontSize: '0.86rem',
    padding: '24px',
    textAlign: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  label: {
    display: 'block',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: '6px',
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
