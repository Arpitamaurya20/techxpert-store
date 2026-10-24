import React, { useCallback, useEffect, useState } from 'react';
import { Package, Boxes, Edit2, Plus, Trash2 } from 'lucide-react';
import type { Product, Category } from '../types';
import {
  DataTable,
  StatGrid,
  Badge,
  Button,
  Field,
  FormError,
  LoadState,
  Modal,
  NotGiven,
  PageIntro,
  useConfirm,
} from './ui';
import type { Column, StatItem } from './ui';
import { api } from '../services/api';
import { inr } from '../services/format';

export type NewProductInput = {
  name: string;
  categoryId: string;
  price: number;
  unit: string;
  stockQuantity: number;
  description: string;
  quantityStep: number;
  sku?: string;
  brandName?: string;
};

const PAGE_SIZE = 50;
const ALL = 'all';
const HIGHLIGHT_MAX = 8;
const SPEC_MAX = 16;

let nextPageKey = 1;
function pageKey() {
  nextPageKey += 1;
  return `page-${nextPageKey}`;
}

interface CatalogOverviewProps {
  /** First page from the shell's load, shown until this screen's own page arrives. */
  products: Product[];
  catalogTotal?: number;
  onCatalogTotalChange?: (total: number) => void;
  categories: Category[];
  categoriesLoaded: boolean;
  /** Rejects when the server refuses, so the form can stay open and say why. */
  onUpdateProduct: (product: Product) => Promise<void>;
  onCreateProduct: (product: NewProductInput) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
  canEdit?: boolean;
  canDelete?: boolean;
  /** Goes up each time the header's Refresh is pressed; the screen reloads its own data. */
  refreshKey?: number;
}

/** Form values are kept as typed text so a half-typed number is never silently turned into 0. */
interface ProductForm {
  name: string;
  categoryId: string;
  price: string;
  stock: string;
  unit: string;
  quantityStep: string;
  sku: string;
  brandName: string;
  description: string;
  variantStocks: { id: number; name: string; stock: string }[];
  highlights: { key: string; text: string }[];
  specifications: { key: string; label: string; value: string }[];
}

type FormErrors = Partial<Record<keyof ProductForm | 'form', string>>;

const formFor = (product: Product | null): ProductForm => ({
  name: product?.name ?? '',
  categoryId: product ? String(product.categoryId ?? '') : '',
  price: product?.price != null ? String(product.price) : '',
  stock: product ? String(product.stockQuantity ?? 0) : '',
  unit: product?.unit ?? '',
  quantityStep: String(product?.quantityStep ?? 1),
  sku: product?.sku ?? '',
  brandName: product?.brandName ?? '',
  description: product?.description ?? '',
  variantStocks:
    (product?.variants?.length ?? 0) > 1
      ? product!.variants!.map((variant) => ({
          id: Number(variant.id),
          name: variant.name || 'Option',
          stock: String(variant.stockQuantity ?? 0),
        }))
      : [],
  highlights: (product?.highlights ?? []).map((text) => ({ key: pageKey(), text })),
  specifications: (product?.specifications ?? []).map((row) => ({
    key: pageKey(),
    label: row.label,
    value: row.value,
  })),
});

/** Mirrors the server: a new product needs a price; an edited one may have it removed. A price must be more than ₹0. */
function checkForm(form: ProductForm, editing: Product | null): FormErrors {
  const errors: FormErrors = {};
  if (form.name.trim().length < 2) errors.name = 'Enter the product name customers will see.';
  if (!editing && !form.categoryId) errors.categoryId = 'Choose a category.';
  const price = form.price.trim();
  if (price === '') {
    if (!editing) errors.price = 'Enter the selling price.';
  } else if (!(Number(price) > 0)) {
    errors.price = 'Enter a price of more than ₹0.';
  }
  if (form.variantStocks.length > 1) {
    if (form.variantStocks.some((variant) => {
      const stock = variant.stock.trim();
      return stock === '' || !Number.isInteger(Number(stock)) || Number(stock) < 0;
    })) {
      errors.stock = 'Enter a whole number, 0 or more, for each option.';
    }
  } else {
    const stock = form.stock.trim();
    if (stock === '' || !Number.isInteger(Number(stock)) || Number(stock) < 0) {
      errors.stock = 'Enter a whole number, 0 or more.';
    }
  }
  if (!form.unit.trim()) errors.unit = 'Enter the selling unit, e.g. "50 kg bag".';
  const pack = Number(form.quantityStep.trim());
  if (form.quantityStep.trim() === '' || !Number.isInteger(pack) || pack < 1 || pack > 9999) {
    errors.quantityStep = 'Enter a whole number from 1 to 9,999.';
  }
  const highlights = form.highlights.map((row) => row.text.trim()).filter(Boolean);
  if (highlights.length > HIGHLIGHT_MAX) errors.highlights = 'A product can have up to 8 highlights.';
  else if (highlights.some((text) => text.length > 160)) errors.highlights = 'Each highlight is 160 characters or less.';
  const specs = form.specifications.filter((row) => row.label.trim() || row.value.trim());
  if (specs.length > SPEC_MAX) errors.specifications = 'A product can have up to 16 specifications.';
  else if (specs.some((row) => !row.label.trim() || !row.value.trim())) {
    errors.specifications = 'Each specification needs a name and a value.';
  } else if (specs.some((row) => row.label.trim().length > 80 || row.value.trim().length > 160)) {
    errors.specifications = 'Keep each name to 80 characters and each value to 160.';
  }
  return errors;
}

const stockBadge = (p: Product) => {
  const options = Number(p.variantCount) || 0;
  if (options > 1) return <Badge variant="neutral" size="sm">{options} options</Badge>;
  const qty = Number(p.stockQuantity ?? 0);
  if (p.stockStatus === 'out_of_stock' || qty <= 0) return <Badge variant="danger" size="sm">Out of stock</Badge>;
  if (p.stockStatus === 'low_stock') return <Badge variant="warning" size="sm">{qty.toLocaleString('en-IN')} left</Badge>;
  return <Badge variant="success" size="sm">{qty.toLocaleString('en-IN')} in stock</Badge>;
};

export const CatalogOverview: React.FC<CatalogOverviewProps> = ({
  products: seedProducts,
  catalogTotal: seedTotal,
  onCatalogTotalChange,
  categories,
  categoriesLoaded,
  onUpdateProduct,
  onCreateProduct,
  onDeleteProduct,
  canEdit = true,
  canDelete = true,
  refreshKey = 0,
}) => {
  const { confirm, dialog } = useConfirm();
  const [rows, setRows] = useState<Product[]>(seedProducts);
  const [total, setTotal] = useState(seedTotal || seedProducts.length);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [pageLoaded, setPageLoaded] = useState(seedProducts.length > 0);
  /** `null` editing with the form open means "add". */
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
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
        categoryId: selectedCategory === ALL ? undefined : selectedCategory,
      });
      setRows(result.products as Product[]);
      setTotal(result.meta.total);
      setTotalPages(Math.max(1, result.meta.totalPages));
      setListError(null);
      setPageLoaded(true);
      if (!debouncedSearch && selectedCategory === ALL) onCatalogTotalChange?.(result.meta.total);
    } catch (err: any) {
      setListError(err.message || "The server didn't answer.");
    } finally {
      setListLoading(false);
    }
  }, [page, debouncedSearch, selectedCategory, onCatalogTotalChange]);

  useEffect(() => {
    loadPage();
  }, [loadPage, refreshKey]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedCategory]);

  const filtering = Boolean(debouncedSearch) || selectedCategory !== ALL;

  const stats: StatItem[] = [
    {
      label: filtering ? 'Products matching' : 'Products',
      value: pageLoaded ? total.toLocaleString('en-IN') : '—',
      icon: <Package size={20} />,
      iconColor: 'var(--info)',
    },
    {
      label: 'Categories',
      value: categoriesLoaded ? categories.length : '—',
      icon: <Boxes size={20} />,
      iconColor: 'var(--accent)',
    },
  ];

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = async (product: Product) => {
    let detail: Product = product;
    try {
      const loaded = await api.getProduct(String(product.id));
      if (loaded) {
        detail = {
          ...product,
          ...loaded,
          id: String(loaded.id ?? product.id),
          variants: Array.isArray(loaded.variants) ? loaded.variants : [],
        };
      }
    } catch {
      detail = product;
    }
    setEditing(detail);
    setFormOpen(true);
  };

  const remove = async (product: Product) => {
    const ok = await confirm({
      title: `Remove "${product.name}"?`,
      message: (
        <>
          It disappears from the app and from this list straight away. Orders already placed are not changed. The
          portal can't bring a removed product back.
        </>
      ),
      confirmLabel: 'Remove product',
      destructive: true,
    });
    if (!ok) return;
    try {
      setDeletingId(product.id);
      await onDeleteProduct(product.id);
      await loadPage();
    } catch {
      // The shell already reported it in a toast.
    } finally {
      setDeletingId(null);
    }
  };

  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: 'Product',
      sortable: true,
      render: (p) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={styles.thumb}>
            {p.imageUrl ? (
              <img
                src={p.imageUrl}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <Package size={18} color="var(--text-dim)" />
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={styles.strong}>{p.name}</div>
            <div style={styles.small}>
              {p.sku ? <>SKU <span style={styles.mono}>{p.sku}</span></> : <NotGiven label="No SKU" />}
              {p.brandName ? ` · ${p.brandName}` : ''}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'categoryName',
      header: 'Category',
      render: (p) => {
        const name = categories.find((c) => String(c.id) === String(p.categoryId))?.name || p.categoryName;
        return name ? <Badge variant="neutral" size="sm">{name}</Badge> : <NotGiven label="No category" />;
      },
    },
    {
      key: 'price',
      header: 'Price',
      sortable: true,
      align: 'right',
      render: (p) =>
        p.price == null ? (
          <NotGiven label="No price, can't be sold" />
        ) : (
          <div>
            <div style={styles.money}>{inr(p.price)}</div>
            {p.originalPrice && Number(p.originalPrice) > Number(p.price) ? (
              <div style={styles.mrp}>MRP {inr(p.originalPrice)}</div>
            ) : null}
          </div>
        ),
    },
    {
      key: 'unit',
      header: 'Sold as',
      render: (p) => (p.unit ? <span style={styles.muted}>{p.unit}</span> : <NotGiven />),
    },
    {
      key: 'stockStatus',
      header: 'Stock',
      align: 'center',
      render: stockBadge,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (p) => (
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
          {canEdit ? (
            <Button
              variant="secondary"
              size="sm"
              icon={<Edit2 size={14} />}
              onClick={() => openEdit(p)}
              aria-label={`Edit ${p.name}`}
            >
              Edit
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 size={14} color="var(--danger)" />}
              loading={deletingId === p.id}
              onClick={() => remove(p)}
              aria-label={`Remove ${p.name}`}
            >
              Remove
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <StatGrid items={stats} columns={2} />

      <PageIntro
        actions={
          canEdit ? (
            <Button size="sm" icon={<Plus size={14} />} onClick={openAdd}>
              Add product
            </Button>
          ) : null
        }
      >
        Search looks through every product, {PAGE_SIZE} to a page. Customers can't buy a product until it has a
        price.
        {canEdit ? '' : ' Your role can see products but not change them.'}
      </PageIntro>

      <LoadState
        loading={listLoading}
        error={listError}
        what="products"
        onRetry={loadPage}
        isEmpty={rows.length === 0 && !filtering}
        empty={{
          icon: <Package size={22} />,
          title: 'No products yet',
          description: canEdit
            ? 'Add the first product; customers can buy it once it has a price and stock.'
            : 'Products appear here once someone with products edit access adds them.',
          actionLabel: canEdit ? 'Add product' : undefined,
          onAction: canEdit ? openAdd : undefined,
        }}
      >
        <DataTable<Product>
          data={rows}
          columns={columns}
          keyExtractor={(p) => p.id}
          searchPlaceholder="Search products by name, SKU or brand…"
          loading={listLoading}
          emptyTitle="No products match"
          emptyDescription="Try another search or category."
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
            <select
              className="tx-input"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              aria-label="Show products in category"
              style={{ width: 'auto' }}
            >
              <option value={ALL}>All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          }
        />
      </LoadState>

      {formOpen ? (
        <ProductFormDialog
          key={editing?.id ?? 'new'}
          editing={editing}
          categories={categories}
          confirm={confirm}
          onClose={() => setFormOpen(false)}
          onSave={async (form) => {
            if (editing) {
              const many = form.variantStocks.length > 1;
              await onUpdateProduct({
                ...editing,
                name: form.name.trim(),
                price: form.price.trim() === '' ? null : Number(form.price),
                ...(many
                  ? {
                      variants: form.variantStocks.map((variant) => ({
                        id: variant.id,
                        name: variant.name,
                        stockQuantity: Number(variant.stock),
                      })),
                    }
                  : { stockQuantity: Number(form.stock) }),
                unit: form.unit.trim(),
                quantityStep: Number(form.quantityStep),
                brandName: form.brandName.trim(),
                description: form.description.trim(),
                highlights: form.highlights.map((row) => row.text.trim()).filter(Boolean),
                specifications: form.specifications
                  .filter((row) => row.label.trim() || row.value.trim())
                  .map((row) => ({ label: row.label.trim(), value: row.value.trim() })),
              });
            } else {
              await onCreateProduct({
                name: form.name.trim(),
                categoryId: form.categoryId,
                price: Number(form.price),
                stockQuantity: Number(form.stock),
                unit: form.unit.trim(),
                quantityStep: Number(form.quantityStep),
                description: form.description.trim(),
                sku: form.sku.trim() || undefined,
                brandName: form.brandName.trim() || undefined,
              });
              setPage(1);
            }
            setFormOpen(false);
            await loadPage();
          }}
        />
      ) : null}
      {dialog}
    </div>
  );
};

const ProductFormDialog: React.FC<{
  editing: Product | null;
  categories: Category[];
  onClose: () => void;
  onSave: (form: ProductForm) => Promise<void>;
  /** The page's confirm; its dialog renders after this form, so it shows on top. */
  confirm: ReturnType<typeof useConfirm>['confirm'];
}> = ({ editing, categories, onClose, onSave, confirm }) => {
  const [form, setForm] = useState<ProductForm>(() => formFor(editing));
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  const set = (key: keyof ProductForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key] || errors.form) setErrors((prev) => ({ ...prev, [key]: undefined, form: undefined }));
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const found = checkForm(form, editing);
    setErrors(found);
    if (Object.keys(found).length) return;
    if (editing && editing.price != null && form.price.trim() === '') {
      const ok = await confirm({
        title: `Remove the price of "${editing.name}"?`,
        message: <>Customers can't buy it until it has a price again. Carts that hold it show it as unavailable.</>,
        confirmLabel: 'Remove price',
        destructive: true,
      });
      if (!ok) return;
    }
    try {
      setSaving(true);
      await onSave(form);
    } catch (err: any) {
      setErrors({ form: `Not saved: ${err?.message || 'the server refused it.'}` });
    } finally {
      setSaving(false);
    }
  };

  const formId = editing ? `product-edit-${editing.id}` : 'product-add';

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={editing ? `Edit ${editing.name}` : 'Add product'}
      subtitle={
        editing
          ? editing.sku
            ? `SKU ${editing.sku}`
            : undefined
          : 'Customers can buy it in the app as soon as it has a price and stock.'
      }
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" type="submit" form={formId} loading={saving}>
            {editing ? 'Save changes' : 'Add product'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate style={styles.form}>
        <Field id={`${formId}-name`} label="Product name" error={errors.name}>
          <input
            data-autofocus
            value={form.name}
            onChange={set('name')}
            maxLength={200}
            placeholder="UltraTech OPC 53 Grade Cement 50 kg"
          />
        </Field>
        {editing ? null : (
          <Field id={`${formId}-category`} label="Category" error={errors.categoryId}>
            <select value={form.categoryId} onChange={set('categoryId')}>
              <option value="">{categories.length === 0 ? 'No categories yet' : 'Choose a category'}</option>
              {categories.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <div style={styles.row}>
          <Field
            id={`${formId}-price`}
            label="Price (₹)"
            error={errors.price}
            hint={
              editing
                ? editing.price == null
                  ? 'Leave empty to keep it unpriced.'
                  : 'Empty it to take the product off sale.'
                : undefined
            }
            style={{ flex: 1 }}
          >
            <input inputMode="decimal" value={form.price} onChange={set('price')} placeholder="380" />
          </Field>
          {form.variantStocks.length > 1 ? null : (
            <Field id={`${formId}-stock`} label="Stock" error={errors.stock} style={{ flex: 1 }}>
              <input inputMode="numeric" value={form.stock} onChange={set('stock')} placeholder="100" />
            </Field>
          )}
          <Field id={`${formId}-unit`} label="Sold as" error={errors.unit} style={{ flex: 1.3 }}>
            <input value={form.unit} onChange={set('unit')} maxLength={60} placeholder="50 kg bag" />
          </Field>
          <Field
            id={`${formId}-step`}
            label="Sold in multiples of"
            error={errors.quantityStep}
            hint="1 means any quantity. 6 means 6, then 12, then 18."
            style={{ flex: 1 }}
          >
            <input inputMode="numeric" value={form.quantityStep} onChange={set('quantityStep')} placeholder="1" />
          </Field>
        </div>
        <div style={styles.row}>
          {editing ? null : (
            <Field
              id={`${formId}-sku`}
              label="SKU"
              hint="Leave empty and one is made for you."
              error={errors.sku}
              style={{ flex: 1 }}
            >
              <input value={form.sku} onChange={set('sku')} maxLength={60} />
            </Field>
          )}
          <Field id={`${formId}-brand`} label="Brand" style={{ flex: 1 }}>
            <input value={form.brandName} onChange={set('brandName')} maxLength={100} placeholder="UltraTech" />
          </Field>
        </div>
        {form.variantStocks.length > 1 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {form.variantStocks.map((variant, index) => (
              <Field
                key={variant.id}
                id={`${formId}-option-${variant.id}`}
                label={`${variant.name} stock`}
                error={index === 0 ? errors.stock : null}
                hint={index === 0 ? 'Each option has its own stock. The app sells the one the customer picks.' : undefined}
              >
                <input
                  inputMode="numeric"
                  value={variant.stock}
                  onChange={(event) => {
                    const value = event.target.value;
                    setForm((prev) => ({
                      ...prev,
                      variantStocks: prev.variantStocks.map((row) =>
                        row.id === variant.id ? { ...row, stock: value } : row
                      ),
                    }));
                    if (errors.stock || errors.form) setErrors((prev) => ({ ...prev, stock: undefined, form: undefined }));
                  }}
                />
              </Field>
            ))}
          </div>
        ) : null}
        <Field id={`${formId}-description`} label="Description">
          <textarea value={form.description} onChange={set('description')} maxLength={2000} />
        </Field>
        {editing ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                <span style={styles.strong}>Highlights</span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={form.highlights.length >= HIGHLIGHT_MAX}
                  onClick={() => setForm((prev) => ({ ...prev, highlights: [...prev.highlights, { key: pageKey(), text: '' }] }))}
                >
                  Add highlight
                </Button>
              </div>
              <p style={styles.small}>Short points on the product page. Leave this empty until you have them. Up to 8.</p>
              {form.highlights.map((row, index) => (
                <div key={row.key} style={styles.row}>
                  <Field id={`${formId}-highlight-${row.key}`} label={`Highlight ${index + 1}`} error={index === 0 ? errors.highlights : null} style={{ flex: 1 }}>
                    <input
                      value={row.text}
                      maxLength={160}
                      onChange={(event) => {
                        const value = event.target.value;
                        setForm((prev) => ({
                          ...prev,
                          highlights: prev.highlights.map((item) => (item.key === row.key ? { ...item, text: value } : item)),
                        }));
                        if (errors.highlights || errors.form) setErrors((prev) => ({ ...prev, highlights: undefined, form: undefined }));
                      }}
                    />
                  </Field>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setForm((prev) => ({ ...prev, highlights: prev.highlights.filter((item) => item.key !== row.key) }))}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                <span style={styles.strong}>Specifications</span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={form.specifications.length >= SPEC_MAX}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      specifications: [...prev.specifications, { key: pageKey(), label: '', value: '' }],
                    }))
                  }
                >
                  Add specification
                </Button>
              </div>
              <p style={styles.small}>Name and value rows, such as Sweep and 48 inch. Leave this empty until you have them. Up to 16.</p>
              {form.specifications.map((row, index) => (
                <div key={row.key} style={styles.row}>
                  <Field id={`${formId}-spec-label-${row.key}`} label={`Specification ${index + 1}`} error={index === 0 ? errors.specifications : null} style={{ flex: 1 }}>
                    <input
                      value={row.label}
                      maxLength={80}
                      placeholder="Sweep"
                      onChange={(event) => {
                        const value = event.target.value;
                        setForm((prev) => ({
                          ...prev,
                          specifications: prev.specifications.map((item) => (item.key === row.key ? { ...item, label: value } : item)),
                        }));
                        if (errors.specifications || errors.form) setErrors((prev) => ({ ...prev, specifications: undefined, form: undefined }));
                      }}
                    />
                  </Field>
                  <Field id={`${formId}-spec-value-${row.key}`} label="Value" style={{ flex: 1.4 }}>
                    <input
                      value={row.value}
                      maxLength={160}
                      placeholder="48 inch"
                      onChange={(event) => {
                        const value = event.target.value;
                        setForm((prev) => ({
                          ...prev,
                          specifications: prev.specifications.map((item) => (item.key === row.key ? { ...item, value } : item)),
                        }));
                        if (errors.specifications || errors.form) setErrors((prev) => ({ ...prev, specifications: undefined, form: undefined }));
                      }}
                    />
                  </Field>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setForm((prev) => ({ ...prev, specifications: prev.specifications.filter((item) => item.key !== row.key) }))
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </>
        ) : null}
        {errors.form ? <FormError>{errors.form}</FormError> : null}
      </form>
    </Modal>
  );
};

const styles: Record<string, React.CSSProperties> = {
  thumb: {
    width: '42px',
    height: '42px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-surface-elevated)',
    border: '1px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  strong: {
    fontWeight: 600,
    color: 'var(--text-main)',
    fontSize: '0.88rem',
  },
  small: {
    fontSize: '0.74rem',
    color: 'var(--text-dim)',
    marginTop: '2px',
  },
  mono: {
    fontFamily: 'monospace',
    color: 'var(--text-muted)',
  },
  muted: {
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
  },
  money: {
    fontWeight: 700,
    color: 'var(--text-main)',
    fontVariantNumeric: 'tabular-nums',
    fontSize: '0.9rem',
    whiteSpace: 'nowrap',
  },
  mrp: {
    fontSize: '0.72rem',
    color: 'var(--text-dim)',
    textDecoration: 'line-through',
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
