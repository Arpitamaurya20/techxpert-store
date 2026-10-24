import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api, type PoliciesContent, type PolicyDocument } from '../services/api';
import { Button, EmptyState, Field, FormError, LoadState, PageIntro, Panel, useConfirm, useToast } from './ui';

interface PoliciesManagerProps {
  content: PoliciesContent | null;
  loading: boolean;
  loadError: string | null;
  onRetry: () => void;
  canEdit: boolean;
  onSaved: (content: PoliciesContent) => void;
  onAudit?: (action: string, details: string) => void;
}

type DraftBlock =
  | { key: string; kind: 'paragraph'; text: string }
  | { key: string; kind: 'list'; lines: string };
type DraftSection = { key: string; heading: string; blocks: DraftBlock[] };
type Draft = {
  lastUpdated: string;
  sourceUrl: string;
  intro: { key: string; text: string }[];
  sections: DraftSection[];
};

let nextKey = 1;
function draftKey() {
  nextKey += 1;
  return `policy-${nextKey}`;
}

function toDraft(policy: PolicyDocument): Draft {
  return {
    lastUpdated: policy.lastUpdated,
    sourceUrl: policy.sourceUrl,
    intro: policy.intro.map((text) => ({ key: draftKey(), text })),
    sections: policy.sections.map((section) => ({
      key: draftKey(),
      heading: section.heading,
      blocks: section.blocks.map((block) =>
        typeof block === 'string'
          ? { key: draftKey(), kind: 'paragraph' as const, text: block }
          : { key: draftKey(), kind: 'list' as const, lines: block.join('\n') }
      ),
    })),
  };
}

function isPublished(policy: PolicyDocument): boolean {
  return policy.intro.length > 0 || policy.sections.length > 0;
}

export const PoliciesManager: React.FC<PoliciesManagerProps> = ({
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
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [seen, setSeen] = useState<PoliciesContent | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  if (content && content !== seen) {
    setSeen(content);
    setDrafts(Object.fromEntries(content.policies.map((policy) => [policy.id, toDraft(policy)])));
  }

  const patch = (id: string, update: (draft: Draft) => Draft) => {
    setDrafts((current) => ({ ...current, [id]: update(current[id]) }));
    if (formError) setFormError(null);
  };

  const removeIntro = async (id: string, key: string, text: string) => {
    const name = text.trim() || 'this paragraph';
    if (!(await confirm({ title: 'Remove paragraph', message: `Remove "${name}"?`, confirmLabel: 'Remove', destructive: true }))) return;
    patch(id, (draft) => ({ ...draft, intro: draft.intro.filter((row) => row.key !== key) }));
  };

  const removeSection = async (id: string, key: string, heading: string) => {
    const name = heading.trim() || 'this section';
    if (!(await confirm({ title: 'Remove section', message: `Remove "${name}"?`, confirmLabel: 'Remove', destructive: true }))) return;
    patch(id, (draft) => ({ ...draft, sections: draft.sections.filter((row) => row.key !== key) }));
  };

  const save = async (policy: PolicyDocument) => {
    const draft = drafts[policy.id];
    if (!draft) return;
    const intro = draft.intro.map((row) => row.text.trim()).filter(Boolean);
    const sections = draft.sections.map((section) => ({
      heading: section.heading.trim(),
      blocks: section.blocks
        .map((block) =>
          block.kind === 'paragraph'
            ? block.text.trim()
            : block.lines.split('\n').map((line) => line.trim()).filter(Boolean)
        )
        .filter((block) => (typeof block === 'string' ? block.length > 0 : block.length > 0)),
    }));
    if (sections.some((section) => !section.heading && section.blocks.length > 0)) {
      setFormError('Each section needs a heading.');
      return;
    }
    if (sections.some((section) => section.heading && section.blocks.length === 0)) {
      setFormError('Each section needs a paragraph.');
      return;
    }
    setSavingId(policy.id);
    setFormError(null);
    try {
      const saved = await api.savePolicy(policy.id, {
        lastUpdated: draft.lastUpdated,
        sourceUrl: draft.sourceUrl,
        intro,
        sections: sections.filter((section) => section.heading),
      });
      setDrafts(Object.fromEntries(saved.policies.map((row) => [row.id, toDraft(row)])));
      onSaved(saved);
      const page = saved.policies.find((row) => row.id === policy.id);
      onAudit?.(
        'Saved policy',
        page && isPublished(page) ? `Saved ${policy.title}.` : `Cleared ${policy.title}.`
      );
      toast.success(`${policy.title} saved. The app will show it once it reads this page.`);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'The policy could not be saved.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <PageIntro>
        Privacy, terms, cancellation and shipping. Paste the published words. Leave a page empty until that text
        exists. The app keeps its own copies until it reads these pages.
        {canEdit ? '' : ' Your role can see these pages but not change them.'}
      </PageIntro>
      <LoadState
        loading={loading}
        error={loadError}
        what="the policies"
        onRetry={onRetry}
        isEmpty={content == null}
        empty={{ title: 'No policies yet', description: 'The pages could not be read.' }}
      >
        {(content?.policies ?? []).map((policy) => {
          const draft = drafts[policy.id] ?? toDraft(policy);
          return (
            <Panel
              key={policy.id}
              title={policy.title}
              actions={
                canEdit ? (
                  <Button onClick={() => void save(policy)} loading={savingId === policy.id} disabled={loading || savingId != null}>
                    Save {policy.title}
                  </Button>
                ) : null
              }
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={styles.pair}>
                  <Field id={`policy-updated-${policy.id}`} label="Last updated" hint="Shown only when this page has text. For example, 24 January 2026.">
                    <input
                      value={draft.lastUpdated}
                      maxLength={40}
                      disabled={!canEdit}
                      onChange={(event) => patch(policy.id, (current) => ({ ...current, lastUpdated: event.target.value }))}
                    />
                  </Field>
                  <Field id={`policy-url-${policy.id}`} label="Website link" hint="Optional. Must start with https://. The app opens it as View on website.">
                    <input
                      value={draft.sourceUrl}
                      maxLength={300}
                      disabled={!canEdit}
                      onChange={(event) => patch(policy.id, (current) => ({ ...current, sourceUrl: event.target.value }))}
                    />
                  </Field>
                </div>
                <div style={styles.row}>
                  <strong>Opening</strong>
                  {canEdit ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon={<Plus size={16} />}
                      disabled={draft.intro.length >= 6}
                      onClick={() =>
                        patch(policy.id, (current) => ({
                          ...current,
                          intro: [...current.intro, { key: draftKey(), text: '' }],
                        }))
                      }
                    >
                      Add paragraph
                    </Button>
                  ) : null}
                </div>
                {draft.intro.length === 0 ? (
                  <EmptyState title="No opening yet" description="Add a paragraph when the published text is ready." />
                ) : (
                  draft.intro.map((row, index) => (
                    <div key={row.key} style={styles.card}>
                      <Field id={`policy-intro-${row.key}`} label={`Paragraph ${index + 1}`}>
                        <textarea
                          rows={3}
                          value={row.text}
                          maxLength={800}
                          disabled={!canEdit}
                          onChange={(event) => {
                            const text = event.target.value;
                            patch(policy.id, (current) => ({
                              ...current,
                              intro: current.intro.map((item) => (item.key === row.key ? { ...item, text } : item)),
                            }));
                          }}
                        />
                      </Field>
                      {canEdit ? (
                        <Button type="button" variant="danger" size="sm" icon={<Trash2 size={15} />} onClick={() => void removeIntro(policy.id, row.key, row.text)}>
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  ))
                )}
                <div style={styles.row}>
                  <strong>Sections</strong>
                  {canEdit ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon={<Plus size={16} />}
                      disabled={draft.sections.length >= 24}
                      onClick={() =>
                        patch(policy.id, (current) => ({
                          ...current,
                          sections: [...current.sections, { key: draftKey(), heading: '', blocks: [] }],
                        }))
                      }
                    >
                      Add section
                    </Button>
                  ) : null}
                </div>
                {draft.sections.length === 0 ? (
                  <EmptyState title="No sections yet" description="Add a heading and a paragraph from the published page." />
                ) : (
                  draft.sections.map((section, index) => (
                    <div key={section.key} style={styles.card}>
                      <Field id={`policy-heading-${section.key}`} label={`Section ${index + 1}`}>
                        <input
                          value={section.heading}
                          maxLength={120}
                          disabled={!canEdit}
                          onChange={(event) => {
                            const heading = event.target.value;
                            patch(policy.id, (current) => ({
                              ...current,
                              sections: current.sections.map((item) => (item.key === section.key ? { ...item, heading } : item)),
                            }));
                          }}
                        />
                      </Field>
                      {section.blocks.map((block) =>
                        block.kind === 'paragraph' ? (
                          <Field key={block.key} id={`policy-block-${block.key}`} label="Paragraph">
                            <textarea
                              rows={3}
                              value={block.text}
                              maxLength={800}
                              disabled={!canEdit}
                              onChange={(event) => {
                                const text = event.target.value;
                                patch(policy.id, (current) => ({
                                  ...current,
                                  sections: current.sections.map((item) =>
                                    item.key === section.key
                                      ? {
                                          ...item,
                                          blocks: item.blocks.map((row) =>
                                            row.key === block.key && row.kind === 'paragraph' ? { ...row, text } : row
                                          ),
                                        }
                                      : item
                                  ),
                                }));
                              }}
                            />
                          </Field>
                        ) : (
                          <Field key={block.key} id={`policy-list-${block.key}`} label="Points" hint="One point per line.">
                            <textarea
                              rows={4}
                              value={block.lines}
                              disabled={!canEdit}
                              onChange={(event) => {
                                const lines = event.target.value;
                                patch(policy.id, (current) => ({
                                  ...current,
                                  sections: current.sections.map((item) =>
                                    item.key === section.key
                                      ? {
                                          ...item,
                                          blocks: item.blocks.map((row) =>
                                            row.key === block.key && row.kind === 'list' ? { ...row, lines } : row
                                          ),
                                        }
                                      : item
                                  ),
                                }));
                              }}
                            />
                          </Field>
                        )
                      )}
                      {canEdit ? (
                        <div style={styles.actions}>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              patch(policy.id, (current) => ({
                                ...current,
                                sections: current.sections.map((item) =>
                                  item.key === section.key
                                    ? { ...item, blocks: [...item.blocks, { key: draftKey(), kind: 'paragraph', text: '' }] }
                                    : item
                                ),
                              }))
                            }
                          >
                            Add paragraph
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              patch(policy.id, (current) => ({
                                ...current,
                                sections: current.sections.map((item) =>
                                  item.key === section.key
                                    ? { ...item, blocks: [...item.blocks, { key: draftKey(), kind: 'list', lines: '' }] }
                                    : item
                                ),
                              }))
                            }
                          >
                            Add points
                          </Button>
                          <Button type="button" variant="danger" size="sm" icon={<Trash2 size={15} />} onClick={() => void removeSection(policy.id, section.key, section.heading)}>
                            Remove
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </Panel>
          );
        })}
        {formError ? <FormError>{formError}</FormError> : null}
      </LoadState>
      {dialog}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  pair: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' },
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
