import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Tag, Trash2 } from 'lucide-react';
import { api, type DealsContent } from '../services/api';
import { Button, EmptyState, Field, FormError, LoadState, PageIntro, Panel, useConfirm, useToast } from './ui';

type CatalogueCategory = { id: string | number; name: string };

interface DealsManagerProps {
  content: DealsContent | null;
  categories: CatalogueCategory[];
  loading: boolean;
  loadError: string | null;
  onRetry: () => void;
  canEdit: boolean;
  onSaved: (content: DealsContent) => void;
  onAudit?: (action: string, details: string) => void;
}

type DraftTile = {
  key: string;
  categoryId: string;
  title: string;
  highlight: string;
  tagline: string;
  tone: string;
  imageUrl: string;
};

const DEAL_MAX = 2;

let nextKey = 1;
function draftKey() {
  nextKey += 1;
  return `deal-${nextKey}`;
}

function toDraft(content: DealsContent): DraftTile[] {
  return content.deals.map((deal) => ({
    key: draftKey(),
    categoryId: String(deal.categoryId),
    title: deal.title,
    highlight: deal.highlight,
    tagline: deal.tagline,
    tone: deal.tone,
    imageUrl: deal.imageUrl,
  }));
}

export const DealsManager: React.FC<DealsManagerProps> = ({
  content,
  categories,
  loading,
  loadError,
  onRetry,
  canEdit,
  onSaved,
  onAudit,
}) => {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [tiles, setTiles] = useState<DraftTile[]>([]);
  const [seen, setSeen] = useState<DealsContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (content && content !== seen) {
    setSeen(content);
    setTiles(toDraft(content));
  }

  const chosen = tiles.map((tile) => tile.categoryId).filter(Boolean);

  const move = (index: number, direction: -1 | 1) => {
    setTiles((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [row] = next.splice(index, 1);
      next.splice(target, 0, row);
      return next;
    });
  };

  const remove = async (row: DraftTile) => {
    const name = row.title.trim() || 'this tile';
    if (!(await confirm({ title: 'Remove tile', message: `Remove "${name}" from the deals row?`, confirmLabel: 'Remove', destructive: true }))) {
      return;
    }
    setTiles((current) => current.filter((item) => item.key !== row.key));
  };

  const save = async () => {
    if (tiles.some((tile) => !tile.categoryId || !tile.title.trim())) {
      setFormError('Each tile needs a category and a title.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const saved = await api.saveDeals(
        tiles.map((tile) => ({
          categoryId: Number(tile.categoryId),
          title: tile.title,
          highlight: tile.highlight,
          tagline: tile.tagline,
          tone: tile.tone,
          imageUrl: tile.imageUrl,
        }))
      );
      setTiles(toDraft(saved));
      onSaved(saved);
      onAudit?.(
        'Saved deals',
        saved.deals.length === 0
          ? 'Cleared the deals row.'
          : `Saved ${saved.deals.length} deal tile${saved.deals.length === 1 ? '' : 's'}.`
      );
      toast.success('Deals saved. The app will show them once it reads this row.');
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'The deals could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <PageIntro
        actions={
          canEdit ? (
            <Button onClick={() => void save()} loading={saving} disabled={loading}>
              Save deals
            </Button>
          ) : null
        }
      >
        The two tiles under Deals for You. Each one opens a category that is on sale. Leave the row empty until you
        choose them. The app keeps its own tiles until it reads this row.
        {canEdit ? '' : ' Your role can see this row but not change it.'}
      </PageIntro>
      <LoadState
        loading={loading}
        error={loadError}
        what="the deals"
        onRetry={onRetry}
        isEmpty={content == null}
        empty={{ title: 'No deals yet', description: 'The row could not be read.' }}
      >
        <Panel
          title="Deals for you"
          actions={
            canEdit ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<Plus size={16} />}
                disabled={tiles.length >= DEAL_MAX}
                onClick={() =>
                  setTiles((current) => [
                    ...current,
                    { key: draftKey(), categoryId: '', title: '', highlight: '', tagline: '', tone: 'peach', imageUrl: '' },
                  ])
                }
              >
                Add tile
              </Button>
            ) : null
          }
        >
          {tiles.length === 0 ? (
            <EmptyState
              icon={<Tag size={22} />}
              title="No deals yet"
              description="Add a category tile when you are ready. Two fill the row."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {tiles.map((tile, index) => {
                const options = categories.filter(
                  (row) => String(row.id) === tile.categoryId || !chosen.includes(String(row.id))
                );
                return (
                  <div key={tile.key} style={styles.card}>
                    <Field id={`deal-category-${tile.key}`} label={`Tile ${index + 1}`}>
                      <select
                        value={tile.categoryId}
                        disabled={!canEdit}
                        onChange={(event) => {
                          const categoryId = event.target.value;
                          setTiles((current) => current.map((item) => (item.key === tile.key ? { ...item, categoryId } : item)));
                          if (formError) setFormError(null);
                        }}
                      >
                        <option value="">Choose a category</option>
                        {options.map((row) => (
                          <option key={row.id} value={String(row.id)}>
                            {row.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <div style={styles.pair}>
                      <Field id={`deal-title-${tile.key}`} label="Title">
                        <input
                          value={tile.title}
                          maxLength={32}
                          disabled={!canEdit}
                          onChange={(event) => {
                            const title = event.target.value;
                            setTiles((current) => current.map((item) => (item.key === tile.key ? { ...item, title } : item)));
                          }}
                        />
                      </Field>
                      <Field id={`deal-highlight-${tile.key}`} label="Second line" hint="Optional. For example, Bulk Savings.">
                        <input
                          value={tile.highlight}
                          maxLength={24}
                          disabled={!canEdit}
                          onChange={(event) => {
                            const highlight = event.target.value;
                            setTiles((current) => current.map((item) => (item.key === tile.key ? { ...item, highlight } : item)));
                          }}
                        />
                      </Field>
                    </div>
                    <Field id={`deal-tagline-${tile.key}`} label="Tagline" hint="A short line. Leave discount wording out until a real offer exists.">
                      <input
                        value={tile.tagline}
                        maxLength={60}
                        disabled={!canEdit}
                        onChange={(event) => {
                          const tagline = event.target.value;
                          setTiles((current) => current.map((item) => (item.key === tile.key ? { ...item, tagline } : item)));
                        }}
                      />
                    </Field>
                    <div style={styles.pair}>
                      <Field id={`deal-tone-${tile.key}`} label="Colour">
                        <select
                          value={tile.tone}
                          disabled={!canEdit}
                          onChange={(event) => {
                            const tone = event.target.value;
                            setTiles((current) => current.map((item) => (item.key === tile.key ? { ...item, tone } : item)));
                          }}
                        >
                          <option value="peach">Peach</option>
                          <option value="navy">Navy</option>
                        </select>
                      </Field>
                      <Field id={`deal-image-${tile.key}`} label="Picture" hint="Optional. Starts with http or /. Blank uses the category picture.">
                        <input
                          value={tile.imageUrl}
                          maxLength={1000}
                          disabled={!canEdit}
                          onChange={(event) => {
                            const imageUrl = event.target.value;
                            setTiles((current) => current.map((item) => (item.key === tile.key ? { ...item, imageUrl } : item)));
                          }}
                        />
                      </Field>
                    </div>
                    {canEdit ? (
                      <div style={styles.actions}>
                        <Button type="button" variant="secondary" size="sm" icon={<ArrowUp size={15} />} disabled={index === 0} onClick={() => move(index, -1)}>
                          Up
                        </Button>
                        <Button type="button" variant="secondary" size="sm" icon={<ArrowDown size={15} />} disabled={index === tiles.length - 1} onClick={() => move(index, 1)}>
                          Down
                        </Button>
                        <Button type="button" variant="danger" size="sm" icon={<Trash2 size={15} />} onClick={() => void remove(tile)}>
                          Remove
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
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
  pair: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' },
  actions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
};
