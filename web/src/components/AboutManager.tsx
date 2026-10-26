import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Building2, Plus, Trash2 } from 'lucide-react';
import { api, type AboutContent } from '../services/api';
import { Button, EmptyState, Field, FormError, LoadState, PageIntro, Panel, useConfirm, useToast } from './ui';

interface AboutManagerProps {
  content: AboutContent | null;
  loading: boolean;
  loadError: string | null;
  onRetry: () => void;
  canEdit: boolean;
  onSaved: (content: AboutContent) => void;
  onAudit?: (action: string, details: string) => void;
}

type DraftFact = { key: string; value: string; label: string };
type DraftValue = { key: string; icon: string; title: string; body: string };
type Draft = { missionTitle: string; missionBody: string; facts: DraftFact[]; values: DraftValue[] };

const FACT_MAX = 4;
const VALUE_MAX = 6;

const ICONS: { value: string; label: string }[] = [
  { value: 'ribbon-outline', label: 'Ribbon' },
  { value: 'bulb-outline', label: 'Bulb' },
  { value: 'heart-outline', label: 'Heart' },
  { value: 'shield-checkmark-outline', label: 'Shield' },
  { value: 'people-outline', label: 'People' },
  { value: 'leaf-outline', label: 'Leaf' },
];

let nextKey = 1;
function draftKey() {
  nextKey += 1;
  return `about-${nextKey}`;
}

function toDraft(content: AboutContent): Draft {
  return {
    missionTitle: content.missionTitle,
    missionBody: content.missionBody,
    facts: content.facts.map((fact) => ({ key: draftKey(), value: fact.value, label: fact.label })),
    values: content.values.map((value) => ({
      key: draftKey(),
      icon: value.icon,
      title: value.title,
      body: value.body,
    })),
  };
}

const blank = (): Draft => ({ missionTitle: '', missionBody: '', facts: [], values: [] });

export const AboutManager: React.FC<AboutManagerProps> = ({
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
  const [draft, setDraft] = useState<Draft>(blank);
  const [seen, setSeen] = useState<AboutContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (content && content !== seen) {
    setSeen(content);
    setDraft(toDraft(content));
  }

  const move = <T,>(list: T[], index: number, direction: -1 | 1): T[] | null => {
    const target = index + direction;
    if (target < 0 || target >= list.length) return null;
    const next = [...list];
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row);
    return next;
  };

  const removeFact = async (row: DraftFact) => {
    const name = row.label.trim() || row.value.trim() || 'this fact';
    if (!(await confirm({ title: 'Remove fact', message: `Remove "${name}" from the About page?`, confirmLabel: 'Remove', destructive: true }))) {
      return;
    }
    setDraft((current) => ({ ...current, facts: current.facts.filter((item) => item.key !== row.key) }));
  };

  const removeValue = async (row: DraftValue) => {
    const name = row.title.trim() || 'this value';
    if (!(await confirm({ title: 'Remove value', message: `Remove "${name}" from the About page?`, confirmLabel: 'Remove', destructive: true }))) {
      return;
    }
    setDraft((current) => ({ ...current, values: current.values.filter((item) => item.key !== row.key) }));
  };

  const save = async () => {
    const facts = draft.facts.map((row) => ({ value: row.value.trim(), label: row.label.trim() }));
    const values = draft.values.map((row) => ({ icon: row.icon, title: row.title.trim(), body: row.body.trim() }));
    if (facts.some((fact) => !fact.value || !fact.label)) {
      setFormError('Each fact needs a figure and a name.');
      return;
    }
    if (values.some((value) => !value.title || !value.body)) {
      setFormError('Each value needs a title and a description.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const saved = await api.saveAbout({
        missionTitle: draft.missionTitle,
        missionBody: draft.missionBody,
        facts,
        values,
      });
      setDraft(toDraft(saved));
      onSaved(saved);
      onAudit?.(
        'Saved about page',
        `Saved the about page with ${saved.facts.length} fact${saved.facts.length === 1 ? '' : 's'} and ${saved.values.length} value${saved.values.length === 1 ? '' : 's'}.`
      );
      toast.success('About page saved. The app will show it once it reads this page.');
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'The about page could not be saved.');
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
              Save about page
            </Button>
          ) : null
        }
      >
        The mission, facts and values on About us. Leave them empty until you have the published words. The app keeps
        its own copy until it reads this page.
        {canEdit ? '' : ' Your role can see this page but not change it.'}
      </PageIntro>
      <LoadState
        loading={loading}
        error={loadError}
        what="the about page"
        onRetry={onRetry}
        isEmpty={content == null}
        empty={{ title: 'No about page yet', description: 'The page could not be read.' }}
      >
        <Panel title="Mission">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Field id="about-mission-title" label="Heading">
              <input
                value={draft.missionTitle}
                maxLength={80}
                disabled={!canEdit}
                onChange={(event) => {
                  setDraft((current) => ({ ...current, missionTitle: event.target.value }));
                  if (formError) setFormError(null);
                }}
              />
            </Field>
            <Field id="about-mission-body" label="Paragraph">
              <textarea
                value={draft.missionBody}
                maxLength={600}
                disabled={!canEdit}
                onChange={(event) => {
                  setDraft((current) => ({ ...current, missionBody: event.target.value }));
                  if (formError) setFormError(null);
                }}
              />
            </Field>
          </div>
        </Panel>
        <Panel
          title="Facts"
          actions={
            canEdit ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<Plus size={16} />}
                disabled={draft.facts.length >= FACT_MAX}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    facts: [...current.facts, { key: draftKey(), value: '', label: '' }],
                  }))
                }
              >
                Add fact
              </Button>
            ) : null
          }
        >
          {draft.facts.length === 0 ? (
            <EmptyState
              icon={<Building2 size={22} />}
              title="No facts yet"
              description="Add a figure, such as 2017, and a name, such as Founded. Four fill the row."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {draft.facts.map((row, index) => (
                <div key={row.key} style={styles.card}>
                  <div style={styles.pair}>
                    <Field id={`about-fact-value-${row.key}`} label={`Figure ${index + 1}`}>
                      <input
                        value={row.value}
                        maxLength={16}
                        disabled={!canEdit}
                        onChange={(event) => {
                          const value = event.target.value;
                          setDraft((current) => ({
                            ...current,
                            facts: current.facts.map((item) => (item.key === row.key ? { ...item, value } : item)),
                          }));
                        }}
                      />
                    </Field>
                    <Field id={`about-fact-label-${row.key}`} label="Name">
                      <input
                        value={row.label}
                        maxLength={32}
                        disabled={!canEdit}
                        onChange={(event) => {
                          const label = event.target.value;
                          setDraft((current) => ({
                            ...current,
                            facts: current.facts.map((item) => (item.key === row.key ? { ...item, label } : item)),
                          }));
                        }}
                      />
                    </Field>
                  </div>
                  {canEdit ? (
                    <div style={styles.actions}>
                      <Button type="button" variant="secondary" size="sm" icon={<ArrowUp size={15} />} disabled={index === 0} onClick={() => {
                        const facts = move(draft.facts, index, -1);
                        if (facts) setDraft((current) => ({ ...current, facts }));
                      }}>
                        Up
                      </Button>
                      <Button type="button" variant="secondary" size="sm" icon={<ArrowDown size={15} />} disabled={index === draft.facts.length - 1} onClick={() => {
                        const facts = move(draft.facts, index, 1);
                        if (facts) setDraft((current) => ({ ...current, facts }));
                      }}>
                        Down
                      </Button>
                      <Button type="button" variant="danger" size="sm" icon={<Trash2 size={15} />} onClick={() => void removeFact(row)}>
                        Remove
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel
          title="Values"
          actions={
            canEdit ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<Plus size={16} />}
                disabled={draft.values.length >= VALUE_MAX}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    values: [...current.values, { key: draftKey(), icon: ICONS[0].value, title: '', body: '' }],
                  }))
                }
              >
                Add value
              </Button>
            ) : null
          }
        >
          {draft.values.length === 0 ? (
            <EmptyState
              icon={<Building2 size={22} />}
              title="No values yet"
              description="Add a title and a short description. Six is the most."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {draft.values.map((row, index) => (
                <div key={row.key} style={styles.card}>
                  <Field id={`about-value-title-${row.key}`} label={`Value ${index + 1}`}>
                    <input
                      value={row.title}
                      maxLength={40}
                      disabled={!canEdit}
                      onChange={(event) => {
                        const title = event.target.value;
                        setDraft((current) => ({
                          ...current,
                          values: current.values.map((item) => (item.key === row.key ? { ...item, title } : item)),
                        }));
                      }}
                    />
                  </Field>
                  <Field id={`about-value-icon-${row.key}`} label="Symbol">
                    <select
                      value={row.icon}
                      disabled={!canEdit}
                      onChange={(event) => {
                        const icon = event.target.value;
                        setDraft((current) => ({
                          ...current,
                          values: current.values.map((item) => (item.key === row.key ? { ...item, icon } : item)),
                        }));
                      }}
                    >
                      {ICONS.map((icon) => (
                        <option key={icon.value} value={icon.value}>
                          {icon.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field id={`about-value-body-${row.key}`} label="Description">
                    <textarea
                      value={row.body}
                      maxLength={240}
                      disabled={!canEdit}
                      onChange={(event) => {
                        const body = event.target.value;
                        setDraft((current) => ({
                          ...current,
                          values: current.values.map((item) => (item.key === row.key ? { ...item, body } : item)),
                        }));
                      }}
                    />
                  </Field>
                  {canEdit ? (
                    <div style={styles.actions}>
                      <Button type="button" variant="secondary" size="sm" icon={<ArrowUp size={15} />} disabled={index === 0} onClick={() => {
                        const values = move(draft.values, index, -1);
                        if (values) setDraft((current) => ({ ...current, values }));
                      }}>
                        Up
                      </Button>
                      <Button type="button" variant="secondary" size="sm" icon={<ArrowDown size={15} />} disabled={index === draft.values.length - 1} onClick={() => {
                        const values = move(draft.values, index, 1);
                        if (values) setDraft((current) => ({ ...current, values }));
                      }}>
                        Down
                      </Button>
                      <Button type="button" variant="danger" size="sm" icon={<Trash2 size={15} />} onClick={() => void removeValue(row)}>
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
  pair: { display: 'grid', gridTemplateColumns: 'minmax(0, 160px) minmax(0, 1fr)', gap: '12px' },
  actions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
};
