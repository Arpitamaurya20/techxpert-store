import React, { useState } from 'react';
import type { ShopRule, ShopSettings } from '../services/api';
import { Button, Field, LoadState, PageIntro } from './ui';

type RuleKey = keyof ShopSettings;

const ROWS: { key: RuleKey; label: string; hint: string; suffix?: string; whole?: boolean }[] = [
  {
    key: 'largeOrderValue',
    label: 'Large-order value (₹)',
    hint: 'An order at or above this value is placed as pending. The goods are held until staff confirm it or cancel it.',
  },
  {
    key: 'largeOrderQuantity',
    label: 'Large-order quantity',
    hint: 'One line at or above this quantity is placed as pending. The goods are held until staff confirm it or cancel it.',
    whole: true,
  },
  {
    key: 'codLimit',
    label: 'Cash on delivery limit (₹)',
    hint: 'Cash on delivery above this amount is refused. The order is not placed.',
  },
  {
    key: 'freeDeliveryFrom',
    label: 'Free delivery from (₹)',
    hint: 'Orders below this pay the delivery fee. Switched off, every order with a fee pays it.',
  },
  {
    key: 'deliveryFee',
    label: 'Delivery fee (₹)',
    hint: 'Switched off, there is no delivery fee.',
  },
  {
    key: 'gstPercent',
    label: 'GST (%)',
    hint: 'Switched off, the order has no GST. Check a change with the accountant.',
    suffix: '%',
  },
];

type Draft = Record<RuleKey, { enabled: boolean; amount: string }>;

const draftFor = (settings: ShopSettings): Draft =>
  Object.fromEntries(
    ROWS.map((row) => [
      row.key,
      {
        enabled: settings[row.key].enabled,
        amount: settings[row.key].amount == null ? '' : String(settings[row.key].amount),
      },
    ])
  ) as Draft;

function ruleError(row: (typeof ROWS)[number], rule: Draft[RuleKey]): string | null {
  if (!rule.enabled && rule.amount.trim() === '') return null;
  const amount = Number(rule.amount);
  const max = row.key === 'gstPercent' ? 100 : row.key === 'largeOrderQuantity' ? 99999 : row.key === 'deliveryFee' ? 100000 : 10000000;
  if (rule.amount.trim() === '' || !Number.isFinite(amount) || amount < 0 || amount > max) {
    return `${row.label.replace(/ \(.*\)/, '')} is a number from 0 to ${max.toLocaleString('en-IN')}.`;
  }
  if (row.whole && !Number.isInteger(amount)) return `${row.label} is a whole number.`;
  if (rule.enabled && amount <= 0 && row.key !== 'deliveryFee' && row.key !== 'gstPercent' && row.key !== 'freeDeliveryFrom') {
    return `${row.label.replace(/ \(.*\)/, '')} is at least 1 while it is switched on.`;
  }
  return null;
}

export const SettingsManager: React.FC<{
  settings: ShopSettings | null;
  loading: boolean;
  loadError: string | null;
  onRetry: () => void;
  canEdit: boolean;
  onSaved: (settings: ShopSettings) => void;
  onAudit: (action: string, details: string) => void;
  save: (body: ShopSettings) => Promise<ShopSettings>;
}> = ({ settings, loading, loadError, onRetry, canEdit, onSaved, onAudit, save }) => {
  const [draft, setDraft] = useState<Draft | null>(settings ? draftFor(settings) : null);
  const [seen, setSeen] = useState(settings);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (settings !== seen) {
    setSeen(settings);
    setDraft(settings ? draftFor(settings) : null);
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    for (const row of ROWS) {
      const problem = ruleError(row, draft[row.key]);
      if (problem) {
        setError(problem);
        return;
      }
    }
    const body = Object.fromEntries(
      ROWS.map((row) => {
        const rule = draft[row.key];
        const amount = rule.amount.trim() === '' ? null : Number(rule.amount);
        return [row.key, { enabled: rule.enabled, amount } satisfies ShopRule];
      })
    ) as ShopSettings;
    try {
      setSaving(true);
      setError(null);
      const saved = await save(body);
      onSaved(saved);
      onAudit('Saved shop settings', 'Delivery, GST and the large-order thresholds');
    } catch (err: any) {
      setError(err?.message || 'The server refused the save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <LoadState
      loading={loading && !settings}
      error={loadError}
      what="shop settings"
      onRetry={onRetry}
      isEmpty={!settings}
      empty={{ title: 'Shop settings are not loaded', description: 'Press Retry to load the delivery fee, GST and the other rules.' }}
    >
      {settings && draft ? (
        <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '640px' }}>
          <PageIntro>
            These rules apply to the next cart and the next order. Switching one off means that limit does not apply.
            A large order is placed as pending and holds its stock. Staff confirm it, or cancel it to put the stock back.
          </PageIntro>
          {ROWS.map((row) => (
            <div key={row.key} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
              <Field id={`shop-${row.key}`} label={row.label} hint={row.hint} style={{ flex: 1 }}>
                <input
                  inputMode={row.whole ? 'numeric' : 'decimal'}
                  value={draft[row.key].amount}
                  disabled={!canEdit}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDraft((prev) => (prev ? { ...prev, [row.key]: { ...prev[row.key], amount: value } } : prev));
                    setError(null);
                  }}
                />
              </Field>
              <label style={{ display: 'flex', gap: '8px', alignItems: 'center', paddingBottom: '10px', whiteSpace: 'nowrap' }}>
                <input
                  type="checkbox"
                  checked={draft[row.key].enabled}
                  disabled={!canEdit}
                  onChange={(event) => {
                    const enabled = event.target.checked;
                    setDraft((prev) => (prev ? { ...prev, [row.key]: { ...prev[row.key], enabled } } : prev));
                    setError(null);
                  }}
                />
                In use
              </label>
            </div>
          ))}
          {error ? <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p> : null}
          {canEdit ? (
            <div>
              <Button type="submit" loading={saving}>
                Save settings
              </Button>
            </div>
          ) : null}
        </form>
      ) : null}
    </LoadState>
  );
};
