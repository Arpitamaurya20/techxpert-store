import React, { useEffect, useState } from 'react';
import { Tag, Percent, Calculator, Plus, Trash2, Pencil } from 'lucide-react';
import type { BulkPriceTier, Product } from '../types';
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
  Panel,
  useConfirm,
} from './ui';
import type { Column, StatItem } from './ui';
import { api } from '../services/api';
import { inr } from '../services/format';
import { tierPrice, tierQuantity, tierSummary } from '../services/bulkTier';

interface BulkPricingManagerProps {
  tiers: BulkPriceTier[];
  /** The first page of products the shell loaded; the price check and the form choose from these. */
  products: Product[];
  productsLoaded: boolean;
  loading: boolean;
  loadError: string | null;
  loaded: boolean;
  onRetry: () => void;
  /** Reject when the server refuses, so the form can stay open and say why. */
  onAddTier: (tier: BulkPriceTier) => Promise<void>;
  onUpdateTier: (tier: BulkPriceTier) => Promise<void>;
  onDeleteTier: (id: string) => Promise<void>;
  canEdit?: boolean;
  canDelete?: boolean;
}

interface CheckOption {
  id: string;
  name: string;
  price: number;
  hasBulk: boolean;
}

interface CalcResult {
  unitPrice: number;
  subtotal: number;
  totalSavings: number;
  appliedTier: Pick<BulkPriceTier, 'minQty' | 'maxQty' | 'discountType' | 'discountValue'> | null;
}

export const BulkPricingManager: React.FC<BulkPricingManagerProps> = ({
  tiers,
  products,
  productsLoaded,
  loading,
  loadError,
  loaded,
  onRetry,
  onAddTier,
  onUpdateTier,
  onDeleteTier,
  canEdit = true,
  canDelete = true,
}) => {
  const { confirm, dialog } = useConfirm();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BulkPriceTier | null>(null);

  const productsWithBulk = new Set(tiers.filter((t) => t.productLive !== 0).map((t) => String(t.productId))).size;
  const removedWithBulk = new Set(tiers.filter((t) => t.productLive === 0).map((t) => String(t.productId))).size;
  const stats: StatItem[] = [
    {
      label: 'Bulk prices',
      value: loaded ? tiers.length : '—',
      icon: <Tag size={20} />,
      iconColor: 'var(--accent)',
    },
    {
      label: 'Products with a bulk price',
      value: loaded ? productsWithBulk : '—',
      subtext:
        loaded && removedWithBulk
          ? `Not counting ${removedWithBulk} removed ${removedWithBulk === 1 ? 'product' : 'products'}`
          : undefined,
      icon: <Percent size={20} />,
      iconColor: 'var(--info)',
    },
  ];

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const remove = async (tier: BulkPriceTier) => {
    const ok = await confirm({
      title: 'Remove this bulk price?',
      message: (
        <>
          <strong>{tierSummary(tier)}</strong> stops applying straight away; customers buying that quantity pay the
          normal price. Orders already placed keep their price. This can't be undone.
        </>
      ),
      confirmLabel: 'Remove bulk price',
      destructive: true,
    });
    if (ok) await onDeleteTier(tier.id);
  };

  const columns: Column<BulkPriceTier>[] = [
    {
      key: 'productName',
      header: 'Product',
      sortable: true,
      render: (t) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={styles.strong}>{t.productName || <NotGiven label="Product name not recorded" />}</span>
          {t.productLive === 0 ? (
            <span style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>
              Removed from the catalogue, so this never applies
            </span>
          ) : t.productSku ? (
            <span style={styles.muted}>SKU {t.productSku}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'minQty',
      header: 'Quantity',
      sortable: true,
      render: (t) => <span style={styles.muted}>{tierQuantity(t)}</span>,
    },
    {
      key: 'discountValue',
      header: 'Bulk price',
      sortable: true,
      render: (t) => (
        <Badge variant="success" size="sm">
          {tierPrice(t)}
        </Badge>
      ),
    },
    {
      key: 'terms',
      header: 'Note',
      render: (t) => (t.terms ? <span style={styles.muted}>{t.terms}</span> : <NotGiven label="No note" />),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (t) => (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          {canEdit ? (
            <Button
              variant="secondary"
              size="sm"
              icon={<Pencil size={14} />}
              onClick={() => {
                setEditing(t);
                setFormOpen(true);
              }}
              aria-label={`Edit ${tierSummary(t)}`}
            >
              Edit
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 size={14} color="var(--danger)" />}
              onClick={() => remove(t)}
              aria-label={`Remove ${tierSummary(t)}`}
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
              Add bulk price
            </Button>
          ) : undefined
        }
      >
        A bulk price lowers the unit price when a customer buys at least a set quantity. The server applies it in the
        cart and at checkout.
        {canEdit ? '' : ' Your role can see bulk prices but not change them.'}
      </PageIntro>

      <PriceCheck products={products} productsLoaded={productsLoaded} tiers={tiers} />

      <LoadState
        loading={loading}
        error={loadError}
        what="bulk prices"
        onRetry={onRetry}
        isEmpty={tiers.length === 0}
        empty={{
          icon: <Tag size={22} />,
          title: 'No bulk prices yet',
          description: canEdit
            ? 'Every quantity is sold at the normal price. Add a bulk price to reward larger orders.'
            : 'Every quantity is sold at the normal price.',
          actionLabel: canEdit ? 'Add bulk price' : undefined,
          onAction: canEdit ? openAdd : undefined,
        }}
      >
        <DataTable<BulkPriceTier>
          data={tiers}
          columns={columns}
          keyExtractor={(t) => t.id}
          searchPlaceholder="Search by product or note…"
          searchKeys={['productName', 'terms']}
          pageSize={10}
          emptyTitle="No bulk prices match"
          emptyDescription="Try another search."
        />
      </LoadState>

      {formOpen ? (
        <TierFormDialog
          key={editing?.id ?? 'new'}
          editing={editing}
          products={products}
          onClose={() => setFormOpen(false)}
          onSave={async (tier) => {
            if (editing) await onUpdateTier(tier);
            else await onAddTier(tier);
            setFormOpen(false);
          }}
        />
      ) : null}
      {dialog}
    </div>
  );
};

/** Asks the server what a customer would pay; never works a price out locally. */
const PriceCheck: React.FC<{ products: Product[]; productsLoaded: boolean; tiers: BulkPriceTier[] }> = ({
  products,
  productsLoaded,
  tiers,
}) => {
  const priced: CheckOption[] = [];
  const seen = new Set<string>();
  for (const t of tiers) {
    const id = String(t.productId ?? '');
    if (!id || seen.has(id) || t.productLive === 0 || t.productPrice == null) continue;
    seen.add(id);
    priced.push({ id, name: t.productName || `Product ${id}`, price: Number(t.productPrice), hasBulk: true });
  }
  for (const p of products) {
    const id = String(p.id);
    if (seen.has(id) || p.price == null) continue;
    seen.add(id);
    priced.push({ id, name: p.name, price: Number(p.price), hasBulk: false });
  }
  const [pickedId, setProductId] = useState('');
  const productId = priced.some((p) => p.id === pickedId) ? pickedId : (priced[0]?.id ?? '');
  const [qtyText, setQtyText] = useState('25');
  const [result, setResult] = useState<CalcResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  /** The request whose answer is on screen; any other key means a check is on its way. */
  const [settledKey, setSettledKey] = useState('');

  const product = priced.find((p) => p.id === productId) ?? null;
  const basePrice = product?.price ?? null;
  const qty = Number(qtyText);
  const qtyError =
    qtyText.trim() === '' || !Number.isInteger(qty) || qty < 1 || qty > 100000
      ? 'Enter a whole number from 1 to 1,00,000.'
      : null;
  const key = `${productId}:${basePrice}:${qty}:${attempt}:${tiers.map((t) => `${t.id}-${t.minQty}-${t.maxQty}-${t.discountType}-${t.discountValue}`).join(',')}`;
  const checking = Boolean(product) && !qtyError && settledKey !== key;

  useEffect(() => {
    if (!productId || basePrice == null || qtyError) return;
    let stale = false;
    api
      .calculateBulkPrice(productId, qty, basePrice)
      .then((data: CalcResult) => {
        if (stale) return;
        setError(null);
        setResult(data);
        setSettledKey(key);
      })
      .catch((err) => {
        if (stale) return;
        setResult(null);
        setError(err instanceof Error ? err.message : "The server didn't answer.");
        setSettledKey(key);
      });
    return () => {
      stale = true;
    };
  }, [productId, basePrice, qty, qtyError, key]);

  const shown = product && !qtyError ? result : null;
  const option = (p: CheckOption) => (
    <option key={p.id} value={p.id}>
      {p.name} ({inr(p.price)})
    </option>
  );
  const withBulk = priced.filter((p) => p.hasBulk);
  const without = priced.filter((p) => !p.hasBulk);

  return (
    <Panel title="Price check">
      <p style={styles.panelHint}>What a customer pays for a quantity, as the server works it out in the cart.</p>
      {priced.length === 0 ? (
        <p style={styles.panelHint}>
          {productsLoaded
            ? `None of the first ${products.length} products has a price yet, so there is nothing to check.`
            : 'Loading products…'}
        </p>
      ) : (
        <div style={styles.calcGrid}>
          <div style={styles.calcInputs}>
            <Field id="price-check-product" label="Product" style={{ flex: 1, minWidth: '220px' }}>
              <select value={productId} onChange={(e) => setProductId(e.target.value)}>
                {withBulk.length && without.length ? (
                  <>
                    <optgroup label="Has a bulk price">{withBulk.map(option)}</optgroup>
                    <optgroup label="No bulk price">{without.map(option)}</optgroup>
                  </>
                ) : (
                  priced.map(option)
                )}
              </select>
            </Field>
            <Field id="price-check-qty" label="Quantity" error={qtyError} style={{ width: '140px' }}>
              <input inputMode="numeric" value={qtyText} onChange={(e) => setQtyText(e.target.value.replace(/\D/g, ''))} />
            </Field>
          </div>

          <div style={styles.calcResult} aria-live="polite">
            <LoadState
              loading={checking}
              error={qtyError ? null : error}
              what="the price"
              onRetry={() => setAttempt((n) => n + 1)}
              isEmpty={!shown}
              empty={{
                icon: <Calculator size={20} />,
                title: 'No price to show',
                description: qtyError ? 'Fix the quantity to see the price.' : 'Choose a product and quantity.',
              }}
            >
              {shown && product ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={styles.calcLine}>
                    <span>Normal price</span>
                    <span>{inr(Number(product.price))} each</span>
                  </div>
                  <div style={styles.calcLine}>
                    <span>Bulk price applied</span>
                    <span>
                      {shown.appliedTier ? (
                        `${tierPrice(shown.appliedTier)} (${tierQuantity(shown.appliedTier)})`
                      ) : (
                        <NotGiven label="None at this quantity" />
                      )}
                    </span>
                  </div>
                  <div style={styles.calcLine}>
                    <span>Unit price</span>
                    <strong>{inr(Number(shown.unitPrice))}</strong>
                  </div>
                  <div style={styles.calcTotal}>
                    <span>For {qty.toLocaleString('en-IN')}</span>
                    <span>{inr(Number(shown.subtotal))}</span>
                  </div>
                  <div style={styles.calcNote}>
                    Before delivery and tax.
                    {Number(shown.totalSavings) > 0 ? ` Saves ${inr(Number(shown.totalSavings))} on the normal price.` : ''}
                  </div>
                </div>
              ) : null}
            </LoadState>
          </div>
        </div>
      )}
    </Panel>
  );
};

interface TierForm {
  productId: string;
  minQty: string;
  maxQty: string;
  discountType: 'percentage' | 'fixed_price';
  discountValue: string;
  terms: string;
}

type TierErrors = Partial<Record<keyof TierForm | 'form', string>>;

const TierFormDialog: React.FC<{
  editing: BulkPriceTier | null;
  products: Product[];
  onClose: () => void;
  onSave: (tier: BulkPriceTier) => Promise<void>;
}> = ({ editing, products, onClose, onSave }) => {
  const [form, setForm] = useState<TierForm>(() => ({
    productId: editing?.productId != null ? String(editing.productId) : '',
    minQty: editing ? String(editing.minQty) : '',
    maxQty: editing?.maxQty ? String(editing.maxQty) : '',
    discountType: editing?.discountType === 'fixed_price' ? 'fixed_price' : 'percentage',
    discountValue: editing ? String(editing.discountValue) : '',
    terms: editing?.terms ?? '',
  }));
  const [errors, setErrors] = useState<TierErrors>({});
  const [saving, setSaving] = useState(false);

  /** The tier's own product stays choosable even when it isn't in the loaded page. */
  const options: { id: string; name: string; price?: number | null }[] =
    editing?.productId != null && !products.some((p) => String(p.id) === String(editing.productId))
      ? [
          {
            id: String(editing.productId),
            name:
              (editing.productName || `Product ${editing.productId}`) +
              (editing.productLive === 0 ? ' — removed from the catalogue' : ''),
            price: editing.productPrice ?? null,
          },
          ...products,
        ]
      : products;
  const product = options.find((p) => String(p.id) === form.productId) ?? null;

  const set = (key: keyof TierForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key] || errors.form) setErrors((prev) => ({ ...prev, [key]: undefined, form: undefined }));
  };

  const check = (): TierErrors => {
    const found: TierErrors = {};
    if (!form.productId) found.productId = 'Choose the product.';
    const min = Number(form.minQty);
    if (!Number.isInteger(min) || min < 1) found.minQty = 'Enter a whole number, 1 or more.';
    if (form.maxQty.trim()) {
      const max = Number(form.maxQty);
      if (!Number.isInteger(max) || max < min) found.maxQty = 'Leave empty for no upper limit, or enter at least the "from" quantity.';
    }
    const value = Number(form.discountValue);
    if (form.discountType === 'percentage') {
      if (!(value > 0 && value <= 90)) found.discountValue = 'Enter a discount from 1 to 90%.';
    } else if (!(value > 0)) {
      found.discountValue = 'Enter a unit price of more than ₹0.';
    } else if (product?.price != null && value >= Number(product.price)) {
      found.discountValue = `Enter less than the normal price of ${inr(Number(product.price))}.`;
    }
    return found;
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const found = check();
    setErrors(found);
    if (Object.keys(found).length) return;
    try {
      setSaving(true);
      await onSave({
        id: editing?.id ?? '',
        productId: form.productId,
        productName: product?.name || editing?.productName,
        minQty: Number(form.minQty),
        maxQty: form.maxQty.trim() ? Number(form.maxQty) : undefined,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        terms: form.terms.trim(),
      });
    } catch (err: any) {
      setErrors({ form: `Not saved: ${err?.message || 'the server refused it.'}` });
    } finally {
      setSaving(false);
    }
  };

  const formId = editing ? `tier-edit-${editing.id}` : 'tier-add';

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={editing ? 'Edit bulk price' : 'Add bulk price'}
      subtitle="Applies in the cart and at checkout as soon as it's saved."
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" type="submit" form={formId} loading={saving}>
            {editing ? 'Save changes' : 'Add bulk price'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate style={styles.form}>
        <Field
          id={`${formId}-product`}
          label="Product"
          error={errors.productId}
          hint={`Choose from the first ${products.length} products in the catalogue.`}
        >
          <select data-autofocus value={form.productId} onChange={set('productId')}>
            <option value="" disabled>
              Choose a product
            </option>
            {options.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name}
                {p.price == null ? ' (no price yet)' : ` (${inr(Number(p.price))})`}
              </option>
            ))}
          </select>
        </Field>

        <div style={styles.row}>
          <Field id={`${formId}-min`} label="From quantity" error={errors.minQty} style={{ flex: 1 }}>
            <input inputMode="numeric" value={form.minQty} onChange={set('minQty')} placeholder="10" />
          </Field>
          <Field
            id={`${formId}-max`}
            label="Up to quantity"
            error={errors.maxQty}
            hint="Leave empty for no upper limit."
            style={{ flex: 1 }}
          >
            <input inputMode="numeric" value={form.maxQty} onChange={set('maxQty')} placeholder="49" />
          </Field>
        </div>

        <div style={styles.row}>
          <Field id={`${formId}-type`} label="Kind" style={{ flex: 1 }}>
            <select value={form.discountType} onChange={set('discountType')}>
              <option value="percentage">Percent off the normal price</option>
              <option value="fixed_price">Fixed unit price</option>
            </select>
          </Field>
          <Field
            id={`${formId}-value`}
            label={form.discountType === 'fixed_price' ? 'Unit price (₹)' : 'Discount (%)'}
            error={errors.discountValue}
            style={{ flex: 1 }}
          >
            <input
              inputMode="decimal"
              value={form.discountValue}
              onChange={set('discountValue')}
              placeholder={form.discountType === 'fixed_price' ? '350' : '10'}
            />
          </Field>
        </div>

        <Field id={`${formId}-note`} label="Note" hint="For staff. The app doesn't show this note yet.">
          <input value={form.terms} onChange={set('terms')} maxLength={200} placeholder="For GST-registered contractors" />
        </Field>
        {errors.form ? <FormError>{errors.form}</FormError> : null}
      </form>
    </Modal>
  );
};

const styles: Record<string, React.CSSProperties> = {
  strong: {
    fontWeight: 600,
    color: 'var(--text-main)',
    fontSize: '0.88rem',
  },
  muted: {
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
  },
  panelHint: {
    margin: 0,
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
  },
  calcGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
    gap: '20px',
    alignItems: 'start',
  },
  calcInputs: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  calcResult: {
    background: 'var(--tint-2)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: '14px 16px',
  },
  calcLine: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    fontSize: '0.84rem',
    color: 'var(--text-muted)',
  },
  calcTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '1rem',
    fontWeight: 800,
    color: 'var(--text-main)',
    borderTop: '1px solid var(--border-subtle)',
    paddingTop: '8px',
  },
  calcNote: {
    fontSize: '0.74rem',
    color: 'var(--text-dim)',
    textAlign: 'right',
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
