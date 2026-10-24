import React, { useState } from 'react';
import { ArrowDown, ArrowUp, LayoutGrid, Plus, Trash2 } from 'lucide-react';
import { api, type HomeContent } from '../services/api';
import { Button, EmptyState, Field, FormError, LoadState, PageIntro, Panel, useConfirm, useToast } from './ui';

type CatalogueCategory = { id: string | number; name: string };

interface HomeMerchManagerProps {
  content: HomeContent | null;
  categories: CatalogueCategory[];
  loading: boolean;
  loadError: string | null;
  onRetry: () => void;
  canEdit: boolean;
  onSaved: (home: HomeContent) => void;
  onAudit?: (action: string, details: string) => void;
}

type DraftShortcut = { key: string; categoryId: string; label: string };
type DraftProject = {
  key: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  calculator: string;
  categoryIds: string[];
};
type Draft = { shortcuts: DraftShortcut[]; projects: DraftProject[] };

const SHORTCUT_MAX = 7;
const PROJECT_MAX = 12;
const PROJECT_CATEGORY_MAX = 8;

let nextKey = 1;
function draftKey() {
  nextKey += 1;
  return `new-${nextKey}`;
}

function toDraft(home: HomeContent): Draft {
  return {
    shortcuts: home.shortcuts.map((row) => ({
      key: draftKey(),
      categoryId: String(row.categoryId),
      label: row.label,
    })),
    projects: home.projects.map((project) => ({
      key: draftKey(),
      title: project.title,
      subtitle: project.subtitle,
      imageUrl: project.imageUrl,
      calculator: project.calculator,
      categoryIds: project.categories.map((row) => String(row.categoryId)),
    })),
  };
}

const blank = (): Draft => ({ shortcuts: [], projects: [] });

function categoryName(categories: CatalogueCategory[], id: string): string {
  return categories.find((row) => String(row.id) === id)?.name ?? '';
}

export const HomeMerchManager: React.FC<HomeMerchManagerProps> = ({
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
  const [draft, setDraft] = useState<Draft>(blank);
  const [seen, setSeen] = useState<HomeContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (content && content !== seen) {
    setSeen(content);
    setDraft(toDraft(content));
  }

  const optionsFor = (selected: string[], current: string) =>
    categories.filter((row) => String(row.id) === current || !selected.includes(String(row.id)));

  const addShortcut = () => {
    const used = new Set(draft.shortcuts.map((row) => row.categoryId));
    const next = categories.find((row) => !used.has(String(row.id)));
    if (!next || draft.shortcuts.length >= SHORTCUT_MAX) return;
    setDraft((current) => ({
      ...current,
      shortcuts: [...current.shortcuts, { key: draftKey(), categoryId: String(next.id), label: '' }],
    }));
  };

  const move = <T,>(list: T[], index: number, direction: -1 | 1): T[] | null => {
    const target = index + direction;
    if (target < 0 || target >= list.length) return null;
    const next = [...list];
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row);
    return next;
  };

  const removeShortcut = async (row: DraftShortcut) => {
    const name = row.label.trim() || categoryName(categories, row.categoryId) || 'this shortcut';
    if (!(await confirm({ title: 'Remove shortcut', message: `Remove "${name}" from the home row?`, confirmLabel: 'Remove', destructive: true }))) {
      return;
    }
    setDraft((current) => ({ ...current, shortcuts: current.shortcuts.filter((item) => item.key !== row.key) }));
  };

  const removeProject = async (project: DraftProject) => {
    const name = project.title.trim() || 'this project';
    if (!(await confirm({ title: 'Remove project', message: `Remove "${name}" from the home screen?`, confirmLabel: 'Remove', destructive: true }))) {
      return;
    }
    setDraft((current) => ({ ...current, projects: current.projects.filter((item) => item.key !== project.key) }));
  };

  const save = async () => {
    if (draft.shortcuts.some((row) => !row.categoryId)) {
      setFormError('Each shortcut needs a category.');
      return;
    }
    if (draft.projects.some((project) => !project.title.trim())) {
      setFormError('Each project needs a title.');
      return;
    }
    if (draft.projects.some((project) => project.categoryIds.length === 0)) {
      setFormError('Each project needs at least one category.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const saved = await api.saveHome({
        shortcuts: draft.shortcuts.map((row) => ({ categoryId: Number(row.categoryId), label: row.label })),
        projects: draft.projects.map((project) => ({
          title: project.title,
          subtitle: project.subtitle,
          imageUrl: project.imageUrl,
          calculator: project.calculator,
          categoryIds: project.categoryIds.map((id) => Number(id)),
        })),
      });
      setDraft(toDraft(saved));
      onSaved(saved);
      const shortcuts = saved.shortcuts.length;
      const projects = saved.projects.length;
      onAudit?.(
        'Saved home shortcuts',
        `Saved ${shortcuts} shortcut${shortcuts === 1 ? '' : 's'} and ${projects} project${projects === 1 ? '' : 's'}.`
      );
      toast.success('Home shortcuts saved. The app will show them once it reads this page.');
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'The home page could not be saved.');
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
              Save home page
            </Button>
          ) : null
        }
      >
        The category row under the app header, and the project tiles. Leave both empty until the categories are
        chosen. The app adds More after the row.
        {canEdit ? '' : ' Your role can see this page but not change it.'}
      </PageIntro>

      <LoadState
        loading={loading}
        error={loadError}
        what="the home shortcuts"
        onRetry={onRetry}
        isEmpty={content == null}
        empty={{ title: 'No home page yet', description: 'The shortcuts could not be read.' }}
      >
        <Panel
          title="Category shortcuts"
          actions={
            canEdit ? (
              <Button
                variant="secondary"
                size="sm"
                icon={<Plus size={16} />}
                onClick={addShortcut}
                disabled={draft.shortcuts.length >= SHORTCUT_MAX || categories.length === 0}
              >
                Add shortcut
              </Button>
            ) : null
          }
        >
          {draft.shortcuts.length === 0 ? (
            <EmptyState
              icon={<LayoutGrid size={22} />}
              title="No shortcuts yet"
              description="Add a category when you want it on the home row. Seven fills the row; the app adds More."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {draft.shortcuts.map((row, index) => {
                const known = categoryName(categories, row.categoryId);
                return (
                  <div key={row.key} style={styles.card}>
                    <Field
                      id={`shortcut-category-${row.key}`}
                      label={`Shortcut ${index + 1}`}
                      hint={known ? 'Leave the name blank to use the category name.' : 'This category is no longer on sale.'}
                    >
                      <select
                        value={row.categoryId}
                        disabled={!canEdit}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            shortcuts: current.shortcuts.map((item) =>
                              item.key === row.key ? { ...item, categoryId: event.target.value } : item
                            ),
                          }))
                        }
                      >
                        {!known && row.categoryId ? <option value={row.categoryId}>Category {row.categoryId}</option> : null}
                        {optionsFor(draft.shortcuts.map((item) => item.categoryId), row.categoryId).map((category) => (
                          <option key={String(category.id)} value={String(category.id)}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field id={`shortcut-label-${row.key}`} label="Name on the tile">
                      <input
                        value={row.label}
                        maxLength={24}
                        disabled={!canEdit}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            shortcuts: current.shortcuts.map((item) =>
                              item.key === row.key ? { ...item, label: event.target.value } : item
                            ),
                          }))
                        }
                      />
                    </Field>
                    {canEdit ? (
                      <div style={styles.actions}>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<ArrowUp size={15} />}
                          disabled={index === 0}
                          onClick={() => {
                            const shortcuts = move(draft.shortcuts, index, -1);
                            if (shortcuts) setDraft((current) => ({ ...current, shortcuts }));
                          }}
                        >
                          Up
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<ArrowDown size={15} />}
                          disabled={index === draft.shortcuts.length - 1}
                          onClick={() => {
                            const shortcuts = move(draft.shortcuts, index, 1);
                            if (shortcuts) setDraft((current) => ({ ...current, shortcuts }));
                          }}
                        >
                          Down
                        </Button>
                        <Button variant="danger" size="sm" icon={<Trash2 size={15} />} onClick={() => void removeShortcut(row)}>
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

        <Panel
          title="Shop by project"
          actions={
            canEdit ? (
              <Button
                variant="secondary"
                size="sm"
                icon={<Plus size={16} />}
                disabled={draft.projects.length >= PROJECT_MAX}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    projects: [
                      ...current.projects,
                      { key: draftKey(), title: '', subtitle: '', imageUrl: '', calculator: '', categoryIds: [] },
                    ],
                  }))
                }
              >
                Add project
              </Button>
            ) : null
          }
        >
          {draft.projects.length === 0 ? (
            <EmptyState
              icon={<LayoutGrid size={22} />}
              title="No projects yet"
              description="Add a project when its title, picture and categories are ready. The app opens that list from the tile."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {draft.projects.map((project, index) => (
                <div key={project.key} style={styles.card}>
                  <div style={styles.grid}>
                    <Field id={`project-title-${project.key}`} label={`Project ${index + 1}`}>
                      <input
                        value={project.title}
                        maxLength={60}
                        disabled={!canEdit}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            projects: current.projects.map((item) =>
                              item.key === project.key ? { ...item, title: event.target.value } : item
                            ),
                          }))
                        }
                      />
                    </Field>
                    <Field id={`project-subtitle-${project.key}`} label="Subtitle">
                      <input
                        value={project.subtitle}
                        maxLength={80}
                        disabled={!canEdit}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            projects: current.projects.map((item) =>
                              item.key === project.key ? { ...item, subtitle: event.target.value } : item
                            ),
                          }))
                        }
                      />
                    </Field>
                    <Field id={`project-image-${project.key}`} label="Image address" hint="A web address or a path starting with /. Leave blank for now.">
                      <input
                        value={project.imageUrl}
                        disabled={!canEdit}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            projects: current.projects.map((item) =>
                              item.key === project.key ? { ...item, imageUrl: event.target.value } : item
                            ),
                          }))
                        }
                      />
                    </Field>
                    <Field id={`project-calculator-${project.key}`} label="Estimator" hint="Shown on the project page. Leave as none until you want one.">
                      <select
                        value={project.calculator}
                        disabled={!canEdit}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            projects: current.projects.map((item) =>
                              item.key === project.key ? { ...item, calculator: event.target.value } : item
                            ),
                          }))
                        }
                      >
                        <option value="">None</option>
                        <option value="paint">Paint</option>
                        <option value="tiles">Tiles</option>
                        <option value="cement">Cement</option>
                      </select>
                    </Field>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {project.categoryIds.map((categoryId, categoryIndex) => {
                      const known = categoryName(categories, categoryId);
                      return (
                        <div key={`${project.key}-${categoryIndex}`} style={styles.categoryRow}>
                          <Field id={`project-${project.key}-cat-${categoryIndex}`} label={`Category ${categoryIndex + 1}`}>
                            <select
                              value={categoryId}
                              disabled={!canEdit}
                              onChange={(event) =>
                                setDraft((current) => ({
                                  ...current,
                                  projects: current.projects.map((item) =>
                                    item.key === project.key
                                      ? {
                                          ...item,
                                          categoryIds: item.categoryIds.map((id, at) =>
                                            at === categoryIndex ? event.target.value : id
                                          ),
                                        }
                                      : item
                                  ),
                                }))
                              }
                            >
                              {!known ? <option value={categoryId}>Category {categoryId}</option> : null}
                              {optionsFor(project.categoryIds, categoryId).map((category) => (
                                <option key={String(category.id)} value={String(category.id)}>
                                  {category.name}
                                </option>
                              ))}
                            </select>
                          </Field>
                          {canEdit ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setDraft((current) => ({
                                  ...current,
                                  projects: current.projects.map((item) =>
                                    item.key === project.key
                                      ? { ...item, categoryIds: item.categoryIds.filter((_, at) => at !== categoryIndex) }
                                      : item
                                  ),
                                }))
                              }
                            >
                              Remove
                            </Button>
                          ) : null}
                        </div>
                      );
                    })}
                    {canEdit && project.categoryIds.length < PROJECT_CATEGORY_MAX ? (
                      <Field id={`project-${project.key}-add`} label="Add a category">
                        <select
                          value=""
                          onChange={(event) => {
                            const categoryId = event.target.value;
                            if (!categoryId) return;
                            setDraft((current) => ({
                              ...current,
                              projects: current.projects.map((item) =>
                                item.key === project.key ? { ...item, categoryIds: [...item.categoryIds, categoryId] } : item
                              ),
                            }));
                          }}
                        >
                          <option value="">Choose a category</option>
                          {optionsFor(project.categoryIds, '').map((category) => (
                            <option key={String(category.id)} value={String(category.id)}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ) : null}
                  </div>
                  {canEdit ? (
                    <div style={styles.actions}>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<ArrowUp size={15} />}
                        disabled={index === 0}
                        onClick={() => {
                          const projects = move(draft.projects, index, -1);
                          if (projects) setDraft((current) => ({ ...current, projects }));
                        }}
                      >
                        Up
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<ArrowDown size={15} />}
                        disabled={index === draft.projects.length - 1}
                        onClick={() => {
                          const projects = move(draft.projects, index, 1);
                          if (projects) setDraft((current) => ({ ...current, projects }));
                        }}
                      >
                        Down
                      </Button>
                      <Button variant="danger" size="sm" icon={<Trash2 size={15} />} onClick={() => void removeProject(project)}>
                        Remove project
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
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' },
  actions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  categoryRow: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '8px', alignItems: 'end' },
};
