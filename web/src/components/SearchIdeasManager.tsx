import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Search, Trash2 } from 'lucide-react';
import { api, type SearchIdeas } from '../services/api';
import { Button, EmptyState, Field, FormError, LoadState, Panel, useConfirm, useToast } from './ui';

interface SearchIdeasManagerProps {
  ideas: SearchIdeas | null;
  loading: boolean;
  loadError: string | null;
  onRetry: () => void;
  canEdit: boolean;
  onSaved: (ideas: SearchIdeas) => void;
  onAudit?: (action: string, details: string) => void;
}

type DraftRow = { key: string; text: string };

const SUGGESTION_MAX = 8;
const PHRASE_MAX = 40;

let nextKey = 1;
function draftKey() {
  nextKey += 1;
  return `idea-${nextKey}`;
}

function toDraft(ideas: SearchIdeas): DraftRow[] {
  return ideas.suggestions.map((text) => ({ key: draftKey(), text }));
}

export const SearchIdeasManager: React.FC<SearchIdeasManagerProps> = ({
  ideas,
  loading,
  loadError,
  onRetry,
  canEdit,
  onSaved,
  onAudit,
}) => {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [draft, setDraft] = useState<DraftRow[]>([]);
  const [seen, setSeen] = useState<SearchIdeas | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (ideas && ideas !== seen) {
    setSeen(ideas);
    setDraft(toDraft(ideas));
  }

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= draft.length) return;
    const next = [...draft];
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row);
    setDraft(next);
  };

  const remove = async (row: DraftRow) => {
    const name = row.text.trim() || 'this search idea';
    if (!(await confirm({ title: 'Remove search idea', message: `Remove "${name}" from the home row?`, confirmLabel: 'Remove', destructive: true }))) {
      return;
    }
    setDraft((current) => current.filter((item) => item.key !== row.key));
    setFormError(null);
  };

  const save = async () => {
    const phrases = draft.map((row) => row.text.trim().replace(/\s+/g, ' '));
    if (phrases.some((phrase) => !phrase)) {
      setFormError('Each search idea needs words.');
      return;
    }
    if (phrases.some((phrase) => phrase.length > PHRASE_MAX)) {
      setFormError('Each search idea is 40 characters or less.');
      return;
    }
    const seenPhrases = new Set<string>();
    if (phrases.some((phrase) => {
      const key = phrase.toLowerCase();
      if (seenPhrases.has(key)) return true;
      seenPhrases.add(key);
      return false;
    })) {
      setFormError('Each search idea can appear only once.');
      return;
    }
    if (phrases.length > SUGGESTION_MAX) {
      setFormError('You can show up to 8 search ideas.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const saved = await api.saveSearchSuggestions(phrases);
      setDraft(toDraft(saved));
      onSaved(saved);
      const count = saved.suggestions.length;
      onAudit?.('Saved search ideas', `Saved ${count} search idea${count === 1 ? '' : 's'}.`);
      toast.success('Search ideas saved. The app will show them once it reads this list.');
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'The search ideas could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        The chips under search on the app home screen. Leave this empty until you have them. The app keeps its own
        list until it reads this one.
        {canEdit ? '' : ' Your role can see this list but not change it.'}
      </p>
      <LoadState
        loading={loading}
        error={loadError}
        what="the search ideas"
        onRetry={onRetry}
        isEmpty={ideas == null}
        empty={{ title: 'No search ideas yet', description: 'The list could not be read.' }}
      >
        <Panel
          title="Try searching"
          actions={
            canEdit ? (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={<Plus size={16} />}
                  disabled={draft.length >= SUGGESTION_MAX}
                  onClick={() => setDraft((current) => [...current, { key: draftKey(), text: '' }])}
                >
                  Add idea
                </Button>
                <Button type="button" onClick={() => void save()} loading={saving} disabled={loading}>
                  Save search ideas
                </Button>
              </div>
            ) : null
          }
        >
          {draft.length === 0 ? (
            <EmptyState
              icon={<Search size={22} />}
              title="No search ideas yet"
              description="Add a short phrase when you want it under the search box. Eight is the most."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {draft.map((row, index) => (
                <div key={row.key} style={styles.row}>
                  <Field id={`search-idea-${row.key}`} label={`Search idea ${index + 1}`} style={{ flex: 1 }}>
                    <input
                      value={row.text}
                      maxLength={PHRASE_MAX}
                      disabled={!canEdit}
                      onChange={(event) => {
                        const value = event.target.value;
                        setDraft((current) => current.map((item) => (item.key === row.key ? { ...item, text: value } : item)));
                        if (formError) setFormError(null);
                      }}
                    />
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
  row: {
    display: 'flex',
    gap: '8px',
    alignItems: 'end',
    flexWrap: 'wrap',
  },
  actions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
};
