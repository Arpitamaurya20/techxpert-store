import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { api, type TrustContent } from '../services/api';
import { Button, EmptyState, Field, FormError, LoadState, Panel, useConfirm, useToast } from './ui';

interface TrustStripManagerProps {
  content: TrustContent | null;
  loading: boolean;
  loadError: string | null;
  onRetry: () => void;
  canEdit: boolean;
  onSaved: (content: TrustContent) => void;
  onAudit?: (action: string, details: string) => void;
}

type DraftClaim = { key: string; label: string; icon: string; action: string };

const TRUST_MAX = 4;
const LABEL_MAX = 32;

const ICONS: { value: string; label: string }[] = [
  { value: 'truck-fast-outline', label: 'Delivery van' },
  { value: 'shield-check-outline', label: 'Shield' },
  { value: 'tag-outline', label: 'Price tag' },
  { value: 'headset', label: 'Headset' },
];

const ACTIONS: { value: string; label: string }[] = [
  { value: 'delivery', label: 'Delivery location' },
  { value: 'about', label: 'About us' },
  { value: 'help', label: 'Help and support' },
  { value: 'phone', label: 'Call support' },
];

let nextKey = 1;
function draftKey() {
  nextKey += 1;
  return `claim-${nextKey}`;
}

function toDraft(content: TrustContent): DraftClaim[] {
  return content.claims.map((claim) => ({
    key: draftKey(),
    label: claim.label,
    icon: claim.icon,
    action: claim.action,
  }));
}

export const TrustStripManager: React.FC<TrustStripManagerProps> = ({
  content,
  loading,
  loadError,
  onRetry,
  canEdit,
  onSaved,
  onAudit,
}) => {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [draft, setDraft] = useState<DraftClaim[]>([]);
  const [seen, setSeen] = useState<TrustContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (content && content !== seen) {
    setSeen(content);
    setDraft(toDraft(content));
  }

  const patch = (key: string, change: Partial<DraftClaim>) => {
    setDraft((current) => current.map((item) => (item.key === key ? { ...item, ...change } : item)));
    if (formError) setFormError(null);
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= draft.length) return;
    const next = [...draft];
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row);
    setDraft(next);
  };

  const remove = async (row: DraftClaim) => {
    const name = row.label.trim() || 'this claim';
    if (!(await confirm({ title: 'Remove claim', message: `Remove "${name}" from the trust strip?`, confirmLabel: 'Remove', destructive: true }))) {
      return;
    }
    setDraft((current) => current.filter((item) => item.key !== row.key));
    setFormError(null);
  };

  const save = async () => {
    const claims = draft.map((row) => ({
      label: row.label.trim().replace(/\s+/g, ' '),
      icon: row.icon,
      action: row.action,
    }));
    if (claims.some((claim) => !claim.label)) {
      setFormError('Each claim needs words.');
      return;
    }
    if (claims.some((claim) => claim.label.length > LABEL_MAX)) {
      setFormError('Each claim is 32 characters or less.');
      return;
    }
    const seenLabels = new Set<string>();
    if (claims.some((claim) => {
      const key = claim.label.toLowerCase();
      if (seenLabels.has(key)) return true;
      seenLabels.add(key);
      return false;
    })) {
      setFormError('Each claim can appear only once.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const saved = await api.saveTrustClaims(claims);
      setDraft(toDraft(saved));
      onSaved(saved);
      const count = saved.claims.length;
      onAudit?.('Saved trust strip', `Saved ${count} claim${count === 1 ? '' : 's'}.`);
      toast.success('Trust strip saved. The app will show it once it reads this list.');
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'The trust strip could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        The four claims under the banners. Leave this empty until you have them. The app keeps its own four until it
        reads this list.
        {canEdit ? '' : ' Your role can see these claims but not change them.'}
      </p>
      <LoadState
        loading={loading}
        error={loadError}
        what="the trust strip"
        onRetry={onRetry}
        isEmpty={content == null}
        empty={{ title: 'No trust strip yet', description: 'The claims could not be read.' }}
      >
        <Panel
          title="Trust strip"
          actions={
            canEdit ? (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={<Plus size={16} />}
                  disabled={draft.length >= TRUST_MAX}
                  onClick={() =>
                    setDraft((current) => [
                      ...current,
                      { key: draftKey(), label: '', icon: ICONS[0].value, action: ACTIONS[0].value },
                    ])
                  }
                >
                  Add claim
                </Button>
                <Button type="button" onClick={() => void save()} loading={saving} disabled={loading}>
                  Save trust strip
                </Button>
              </div>
            ) : null
          }
        >
          {draft.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck size={22} />}
              title="No claims yet"
              description="Add a short claim when you want it on the home screen. Four fill the row."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {draft.map((row, index) => (
                <div key={row.key} style={styles.card}>
                  <Field id={`trust-label-${row.key}`} label={`Claim ${index + 1}`} style={{ flex: 1 }}>
                    <input
                      value={row.label}
                      maxLength={LABEL_MAX}
                      disabled={!canEdit}
                      onChange={(event) => patch(row.key, { label: event.target.value })}
                    />
                  </Field>
                  <Field id={`trust-icon-${row.key}`} label="Symbol">
                    <select value={row.icon} disabled={!canEdit} onChange={(event) => patch(row.key, { icon: event.target.value })}>
                      {ICONS.map((icon) => (
                        <option key={icon.value} value={icon.value}>
                          {icon.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field id={`trust-action-${row.key}`} label="Opens">
                    <select value={row.action} disabled={!canEdit} onChange={(event) => patch(row.key, { action: event.target.value })}>
                      {ACTIONS.map((action) => (
                        <option key={action.value} value={action.value}>
                          {action.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {canEdit ? (
                    <div style={styles.actions}>
                      <Button type="button" variant="secondary" size="sm" icon={<ArrowUp size={15} />} disabled={index === 0} onClick={() => move(index, -1)}>
                        Up
                      </Button>
                      <Button type="button" variant="secondary" size="sm" icon={<ArrowDown size={15} />} disabled={index === draft.length - 1} onClick={() => move(index, 1)}>
                        Down
                      </Button>
                      <Button type="button" variant="danger" size="sm" icon={<Trash2 size={15} />} onClick={() => void remove(row)}>
                        Remove
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Panel>
        {formError ? <FormError>{formError}</FormError> : null}
      </LoadState>
      {dialog}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  card: {
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  actions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
};
