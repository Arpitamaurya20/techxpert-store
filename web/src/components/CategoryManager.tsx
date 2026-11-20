import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Boxes, FolderTree, Plus, Edit2, Trash2, ImagePlus, Trash } from 'lucide-react';
import { api, resolvePortalAsset } from '../services/api';
import type { Category, Subcategory } from '../types';
import {
  Button,
  EmptyState,
  Field,
  FormError,
  LoadState,
  Modal,
  PageIntro,
  Panel,
  StatGrid,
  useConfirm,
  useToast,
} from './ui';
import type { StatItem } from './ui';

interface CategoryManagerProps {
  onHierarchyChanged?: () => void;
  onAudit?: (action: string, details: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  /** Goes up each time the header's Refresh is pressed; the screen reloads its own data. */
  refreshKey?: number;
}

/** Shared by categories and subcategories; `description` is only shown for categories. */
interface GroupForm {
  name: string;
  slug: string;
  displayOrder: string;
  imageUrl: string;
  description: string;
}

type GroupErrors = Partial<Record<keyof GroupForm | 'form', string>>;

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

function checkGroup(form: GroupForm): GroupErrors {
  const errors: GroupErrors = {};
  if (form.name.trim().length < 2) errors.name = 'Enter the name customers will see.';
  if (form.slug.trim() && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(form.slug.trim())) {
    errors.slug = 'Use lowercase letters, numbers and single dashes, e.g. "cement-plaster".';
  }
  const order = Number(form.displayOrder);
  if (form.displayOrder.trim() === '' || !Number.isInteger(order) || order < 0 || order > 9999) {
    errors.displayOrder = 'Enter a whole number from 0 to 9999.';
  }
  return errors;
}

/** Server refusals that belong to one field go under it; anything else under the form. */
function serverErrors(err: unknown): GroupErrors {
  const message = err instanceof Error ? err.message : 'the server refused it.';
  if (/duplicate|already/i.test(message)) return { slug: 'Another one already uses this short code. Choose another.' };
  return { form: `Not saved: ${message}` };
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({
  onHierarchyChanged,
  onAudit,
  canEdit = true,
  canDelete = true,
  refreshKey = 0,
}) => {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [categories, setCategories] = useState<Category[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catError, setCatError] = useState<string | null>(null);
  const [catLoaded, setCatLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [subsError, setSubsError] = useState<string | null>(null);
  /** Which category the subcategory list on screen belongs to. */
  const [subsFor, setSubsFor] = useState<string | null>(null);

  const [catDialog, setCatDialog] = useState<{ editing: Category | null } | null>(null);
  const [subDialog, setSubDialog] = useState<{ editing: Subcategory | null } | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      setCatLoading(true);
      const rows: Category[] = (await api.getCategories()) || [];
      setCategories(rows);
      setCatError(null);
      setCatLoaded(true);
      setSelectedId((prev) => {
        if (prev && rows.some((c) => String(c.id) === prev)) return prev;
        return rows[0] ? String(rows[0].id) : null;
      });
    } catch (err: any) {
      setCatError(err.message || "The server didn't answer.");
    } finally {
      setCatLoading(false);
    }
  }, []);

  const loadSubs = useCallback(async (categoryId: string | null) => {
    if (!categoryId) return;
    try {
      setSubsLoading(true);
      const rows = await api.getSubcategories(categoryId);
      setSubcategories(rows || []);
      setSubsFor(categoryId);
      setSubsError(null);
    } catch (err: any) {
      setSubsError(err.message || "The server didn't answer.");
    } finally {
      setSubsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories, refreshKey]);

  useEffect(() => {
    loadSubs(selectedId);
  }, [selectedId, loadSubs, refreshKey]);

  const selected = categories.find((c) => String(c.id) === selectedId) || null;
  const subsShown = subsFor === selectedId ? subcategories : [];

  const stats: StatItem[] = [
    {
      label: 'Categories',
      value: catLoaded ? categories.length : '—',
      icon: <Boxes size={20} />,
      iconColor: 'var(--accent)',
    },
    {
      label: selected ? `Subcategories in ${selected.name}` : 'Subcategories',
      value: selected && subsFor === selectedId ? subsShown.length : '—',
      icon: <FolderTree size={20} />,
      iconColor: 'var(--info)',
    },
  ];

  const saveCategory = async (form: GroupForm, editing: Category | null, pendingFile?: File | null) => {
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || slugify(form.name),
      description: form.description.trim(),
      imageUrl: form.imageUrl.trim(),
      displayOrder: Number(form.displayOrder),
    };
    if (editing) {
      await api.updateCategory(String(editing.id), payload);
      onAudit?.('Saved category', `Saved category "${payload.name}"`);
      toast.success(`Category "${payload.name}" saved.`);
    } else {
      const created = await api.createCategory({ ...payload, imageUrl: '' });
      if (pendingFile && created?.id) {
        const stored = await api.uploadCategoryImage(String(created.id), pendingFile);
        await api.updateCategory(String(created.id), { imageUrl: stored.imageUrl });
      }
      onAudit?.('Added category', `Added category "${payload.name}"`);
      toast.success(`Category "${payload.name}" added.`);
      if (created?.id) setSelectedId(String(created.id));
    }
    setCatDialog(null);
    await loadCategories();
    requestAnimationFrame(() =>
      document.querySelector('[data-category-row][aria-pressed="true"]')?.scrollIntoView({ block: 'nearest' })
    );
    onHierarchyChanged?.();
  };

  const deleteCategory = async (cat: Category) => {
    const ok = await confirm({
      title: `Remove category "${cat.name}"?`,
      message: (
        <>
          Customers stop seeing <strong>{cat.name}</strong> and its subcategories in the app straight away. Products in
          it are not deleted and orders are not changed. The portal can't bring a removed category back.
        </>
      ),
      confirmLabel: 'Remove category',
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.deleteCategory(String(cat.id));
      onAudit?.('Deleted category', `Removed category "${cat.name}" and its subcategories`);
      toast.success(`Category "${cat.name}" removed.`);
      await loadCategories();
      onHierarchyChanged?.();
    } catch (err: any) {
      toast.error(`Couldn't remove "${cat.name}": ${err.message}`);
    }
  };

  const saveSubcategory = async (form: GroupForm, editing: Subcategory | null, pendingFile?: File | null) => {
    if (!selectedId || !selected) return;
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || slugify(form.name),
      imageUrl: form.imageUrl.trim(),
      displayOrder: Number(form.displayOrder),
      categoryId: selectedId,
    };
    if (editing) {
      await api.updateSubcategory(String(editing.id), payload);
      onAudit?.('Saved subcategory', `Saved subcategory "${payload.name}" in ${selected.name}`);
      toast.success(`Subcategory "${payload.name}" saved.`);
    } else {
      const created = await api.createSubcategory({ ...payload, imageUrl: '' });
      if (pendingFile && created?.id) {
        const stored = await api.uploadSubcategoryImage(String(created.id), pendingFile);
        await api.updateSubcategory(String(created.id), { imageUrl: stored.imageUrl });
      }
      onAudit?.('Added subcategory', `Added subcategory "${payload.name}" to ${selected.name}`);
      toast.success(`Subcategory "${payload.name}" added to ${selected.name}.`);
    }
    setSubDialog(null);
    await loadSubs(selectedId);
    onHierarchyChanged?.();
  };

  const deleteSubcategory = async (sub: Subcategory) => {
    const ok = await confirm({
      title: `Remove subcategory "${sub.name}"?`,
      message: (
        <>
          Customers stop seeing <strong>{sub.name}</strong> in the app straight away. Products are not deleted. The
          portal can't bring a removed subcategory back.
        </>
      ),
      confirmLabel: 'Remove subcategory',
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.deleteSubcategory(String(sub.id));
      onAudit?.('Deleted subcategory', `Removed subcategory "${sub.name}"${selected ? ` from ${selected.name}` : ''}`);
      toast.success(`Subcategory "${sub.name}" removed.`);
      await loadSubs(selectedId);
      onHierarchyChanged?.();
    } catch (err: any) {
      toast.error(`Couldn't remove "${sub.name}": ${err.message}`);
    }
  };

  const productCount = (cat: Category) => cat.productCount ?? cat.activeProducts;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <StatGrid items={stats} columns={2} />

      <PageIntro>
        What customers browse and filter by in the app. Choose a category to see its subcategories.
        {canEdit ? '' : ' Your role can see categories but not change them.'}
      </PageIntro>

      <div style={styles.split}>
        <Panel
          title="Categories"
          style={styles.column}
          actions={
            canEdit ? (
              <Button size="sm" icon={<Plus size={14} />} onClick={() => setCatDialog({ editing: null })}>
                Add category
              </Button>
            ) : undefined
          }
        >
          <LoadState
            loading={catLoading}
            error={catError}
            what="categories"
            onRetry={loadCategories}
            isEmpty={categories.length === 0}
            empty={{
              icon: <Boxes size={22} />,
              title: 'No categories yet',
              description: 'Add a category such as Cement, Paint or Tiles so customers can browse.',
              actionLabel: canEdit ? 'Add category' : undefined,
              onAction: canEdit ? () => setCatDialog({ editing: null }) : undefined,
            }}
          >
            <div style={styles.list}>
              {categories.map((cat) => {
                const active = String(cat.id) === selectedId;
                const count = productCount(cat);
                return (
                  <div key={cat.id} style={{ ...styles.listItem, ...(active ? styles.listItemActive : {}) }}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(String(cat.id))}
                      aria-pressed={active}
                      data-category-row
                      style={styles.selectButton}
                    >
                      {cat.imageUrl ? (
                        <img src={resolvePortalAsset(cat.imageUrl)} alt="" style={styles.thumb} />
                      ) : (
                        <span style={styles.thumbEmpty} aria-hidden />
                      )}
                      <span style={styles.itemCopy}>
                        <span style={styles.itemName}>{cat.name}</span>
                        <span style={styles.itemMeta}>
                          {count !== undefined && count !== null
                            ? `${Number(count).toLocaleString('en-IN')} product${Number(count) === 1 ? '' : 's'}`
                            : 'Product count not available'}
                        </span>
                      </span>
                    </button>
                    <div style={styles.itemActions}>
                      {canEdit ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Edit2 size={13} />}
                          onClick={() => setCatDialog({ editing: cat })}
                          aria-label={`Edit category ${cat.name}`}
                          title="Edit"
                        />
                      ) : null}
                      {canDelete ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 size={13} color="var(--danger)" />}
                          onClick={() => deleteCategory(cat)}
                          aria-label={`Remove category ${cat.name}`}
                          title="Remove"
                        />
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </LoadState>
        </Panel>

        <Panel
          title={selected ? `Subcategories in ${selected.name}` : 'Subcategories'}
          style={styles.column}
          actions={
            canEdit && selected ? (
              <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => setSubDialog({ editing: null })}>
                Add subcategory
              </Button>
            ) : undefined
          }
        >
          {!selected ? (
            <EmptyState title="Choose a category" description="Its subcategories appear here." />
          ) : (
            <LoadState
              loading={subsLoading}
              error={subsError}
              what="subcategories"
              onRetry={() => loadSubs(selectedId)}
              isEmpty={subsShown.length === 0}
              empty={{
                icon: <FolderTree size={22} />,
                title: 'No subcategories yet',
                description: `Customers see ${selected.name} without subcategories.`,
                actionLabel: canEdit ? 'Add subcategory' : undefined,
                onAction: canEdit ? () => setSubDialog({ editing: null }) : undefined,
              }}
            >
              <div style={styles.list}>
                {subsShown.map((sub) => (
                  <div key={sub.id} style={styles.subRow}>
                    {sub.imageUrl ? (
                      <img src={resolvePortalAsset(sub.imageUrl)} alt="" style={styles.thumb} />
                    ) : (
                      <span style={styles.thumbEmpty} aria-hidden />
                    )}
                    <span style={{ ...styles.itemName, flex: 1, minWidth: 0 }}>{sub.name}</span>
                    <div style={styles.itemActions}>
                      {canEdit ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Edit2 size={13} />}
                          onClick={() => setSubDialog({ editing: sub })}
                          aria-label={`Edit subcategory ${sub.name}`}
                          title="Edit"
                        />
                      ) : null}
                      {canDelete ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 size={13} color="var(--danger)" />}
                          onClick={() => deleteSubcategory(sub)}
                          aria-label={`Remove subcategory ${sub.name}`}
                          title="Remove"
                        />
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </LoadState>
          )}
        </Panel>
      </div>

      {catDialog ? (
        <GroupDialog
          key={catDialog.editing?.id ?? 'new-category'}
          kind="category"
          initial={catDialog.editing}
          onClose={() => setCatDialog(null)}
          onSave={(form, pendingFile) => saveCategory(form, catDialog.editing, pendingFile)}
        />
      ) : null}
      {subDialog && selected ? (
        <GroupDialog
          key={subDialog.editing?.id ?? 'new-subcategory'}
          kind="subcategory"
          parentName={selected.name}
          initial={subDialog.editing}
          onClose={() => setSubDialog(null)}
          onSave={(form, pendingFile) => saveSubcategory(form, subDialog.editing, pendingFile)}
        />
      ) : null}
      {dialog}
    </div>
  );
};

const GroupDialog: React.FC<{
  kind: 'category' | 'subcategory';
  parentName?: string;
  initial: (Category | Subcategory) | null;
  onClose: () => void;
  onSave: (form: GroupForm, pendingFile?: File | null) => Promise<void>;
}> = ({ kind, parentName, initial, onClose, onSave }) => {
  const [form, setForm] = useState<GroupForm>(() => ({
    name: initial?.name ?? '',
    slug: initial?.slug ?? '',
    displayOrder: String(initial?.displayOrder ?? 100),
    imageUrl: initial?.imageUrl ?? '',
    description: (initial as Category | null)?.description ?? '',
  }));
  /** A new item's short code follows its name until someone edits the code. */
  const [slugTouched, setSlugTouched] = useState(Boolean(initial));
  const [errors, setErrors] = useState<GroupErrors>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  const set = (key: keyof GroupForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setForm((prev) => ({
      ...prev,
      [key]: value,
      ...(key === 'name' && !slugTouched ? { slug: slugify(value) } : {}),
    }));
    if (key === 'slug') setSlugTouched(true);
    if (errors[key] || errors.form) setErrors((prev) => ({ ...prev, [key]: undefined, form: undefined }));
  };

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    if (file.type && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setUploadError('Use a JPEG, PNG or WebP image.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Use an image of 2 MB or less.');
      return;
    }
    setUploadError(null);

    if (!initial) {
      if (localPreview) URL.revokeObjectURL(localPreview);
      setPendingFile(file);
      setLocalPreview(URL.createObjectURL(file));
      setForm((prev) => ({ ...prev, imageUrl: '' }));
      return;
    }

    setUploading(true);
    try {
      const stored =
        kind === 'category'
          ? await api.uploadCategoryImage(String(initial.id), file)
          : await api.uploadSubcategoryImage(String(initial.id), file);
      if (localPreview) URL.revokeObjectURL(localPreview);
      setLocalPreview(null);
      setPendingFile(null);
      setForm((prev) => ({ ...prev, imageUrl: stored.imageUrl }));
      if (errors.imageUrl || errors.form) setErrors((prev) => ({ ...prev, imageUrl: undefined, form: undefined }));
    } catch (err) {
      setUploadError(`Not uploaded: ${err instanceof Error ? err.message : "the server didn't answer."}`);
    } finally {
      setUploading(false);
    }
  };

  const clearImage = () => {
    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview(null);
    setPendingFile(null);
    setForm((prev) => ({ ...prev, imageUrl: '' }));
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const found = checkGroup(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    try {
      setSaving(true);
      await onSave(form, pendingFile);
    } catch (err) {
      setErrors(serverErrors(err));
    } finally {
      setSaving(false);
    }
  };

  const noun = kind === 'category' ? 'category' : 'subcategory';
  const formId = `${kind}-${initial?.id ?? 'new'}`;
  const previewSrc = localPreview || (form.imageUrl ? resolvePortalAsset(form.imageUrl) : '');
  const hasImage = Boolean(previewSrc);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={initial ? `Edit ${noun}` : `Add ${noun}`}
      subtitle={
        kind === 'category'
          ? "Customers see it in the app's Categories tab."
          : `Customers see it inside ${parentName ?? 'its category'} in the app.`
      }
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" type="submit" form={formId} loading={saving} disabled={uploading}>
            {initial ? 'Save changes' : `Add ${noun}`}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate style={styles.form}>
        <Field id={`${formId}-name`} label="Name" error={errors.name}>
          <input
            data-autofocus
            value={form.name}
            onChange={set('name')}
            maxLength={100}
            placeholder={kind === 'category' ? 'Cement & Plaster' : 'OPC Cement'}
          />
        </Field>
        <div style={styles.row}>
          <Field
            id={`${formId}-slug`}
            label="Short code"
            error={errors.slug}
            hint="Used in app links. Made from the name unless you change it."
            style={{ flex: 2 }}
          >
            <input value={form.slug} onChange={set('slug')} maxLength={50} />
          </Field>
          <Field
            id={`${formId}-order`}
            label="Position"
            error={errors.displayOrder}
            hint="Lower numbers show first."
            style={{ flex: 1 }}
          >
            <input inputMode="numeric" value={form.displayOrder} onChange={set('displayOrder')} />
          </Field>
        </div>

        <Field
          id={`${formId}-upload`}
          label="Image"
          error={uploadError || errors.imageUrl}
          hint={
            uploading
              ? 'Uploading…'
              : 'Choose a JPEG, PNG or WebP from your device (up to 2 MB). No image link needed.'
          }
        >
          <div>
            <input
              ref={fileInputRef}
              id={`${formId}-upload`}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading || saving}
              style={styles.hiddenFile}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                void pickImage(file);
              }}
            />
            {hasImage ? (
              <div style={styles.coverPreview}>
                <img src={previewSrc} alt="" style={styles.coverImg} />
              </div>
            ) : (
              <button
                type="button"
                style={styles.uploadZone}
                disabled={uploading || saving}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus size={22} />
                <span style={styles.uploadZoneTitle}>Upload image</span>
                <span style={styles.uploadZoneHint}>JPEG, PNG or WebP · max 2 MB</span>
              </button>
            )}
            <div style={styles.uploadActions}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<ImagePlus size={14} />}
                disabled={uploading || saving}
                onClick={() => fileInputRef.current?.click()}
              >
                {hasImage ? 'Replace image' : 'Choose image'}
              </Button>
              {hasImage ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={<Trash size={14} color="var(--danger)" />}
                  disabled={uploading || saving}
                  onClick={clearImage}
                >
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
        </Field>

        {kind === 'category' ? (
          <Field id={`${formId}-description`} label="Description">
            <textarea value={form.description} onChange={set('description')} maxLength={500} />
          </Field>
        ) : null}
        {errors.form ? <FormError>{errors.form}</FormError> : null}
      </form>
    </Modal>
  );
};

const styles: Record<string, React.CSSProperties> = {
  split: {
    display: 'grid',
    gridTemplateColumns: 'minmax(260px, 1fr) minmax(280px, 1.2fr)',
    gap: '16px',
    alignItems: 'start',
  },
  column: {
    minHeight: '360px',
  },
  hiddenFile: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
  },
  uploadZone: {
    width: '100%',
    minHeight: '132px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '20px 16px',
    borderRadius: 'var(--radius-sm)',
    border: '1.5px dashed var(--border-strong, var(--border-subtle))',
    background: 'var(--bg-surface-elevated)',
    color: 'var(--text-main)',
    cursor: 'pointer',
  },
  uploadZoneTitle: {
    fontSize: '0.92rem',
    fontWeight: 600,
  },
  uploadZoneHint: {
    fontSize: '0.78rem',
    color: 'var(--text-dim)',
  },
  uploadActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '10px',
  },
  coverPreview: {
    width: '100%',
    height: '160px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-surface-elevated)',
    border: '1px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  coverImg: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
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
    padding: '4px 8px 4px 4px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid transparent',
    background: 'var(--tint-1)',
  },
  listItemActive: {
    background: 'var(--accent-soft)',
    borderColor: 'var(--accent-border)',
  },
  thumb: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    objectFit: 'cover',
    background: 'var(--bg-surface-elevated)',
    border: '1px solid var(--border-subtle)',
    flexShrink: 0,
  },
  thumbEmpty: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    background: 'var(--bg-surface-elevated)',
    border: '1px solid var(--border-subtle)',
    flexShrink: 0,
  },
  itemCopy: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '2px',
  },
  selectButton: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '10px',
    padding: '6px 8px',
    background: 'transparent',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    textAlign: 'left',
    color: 'inherit',
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
    fontSize: '0.74rem',
    color: 'var(--text-dim)',
  },
  itemActions: {
    display: 'flex',
    gap: '2px',
    flexShrink: 0,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  row: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
  },
};
