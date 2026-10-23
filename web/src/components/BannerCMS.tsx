import React, { useState } from 'react';
import {
  Image as ImageIcon,
  Plus,
  ArrowUp,
  ArrowDown,
  Edit2,
  Trash2,
  Play,
  Pause,
  Calendar,
  MousePointerClick,
  EyeOff,
} from 'lucide-react';
import type { Banner, BannerStatus, CtaType } from '../types';
import { api, resolvePortalAsset } from '../services/api';
import { isBannerLive } from '../services/bannerLive';
import { formatWhen } from '../services/format';
import { StatGrid, Badge, Button, Field, FormError, LoadState, Modal, PageIntro, useConfirm } from './ui';
import type { StatItem, BadgeVariant } from './ui';

interface CategoryOption {
  id: string | number;
  name: string;
  slug?: string;
}

interface BannerCMSProps {
  banners: Banner[];
  /** For the button's destination: the app opens categories by id. */
  categories: CategoryOption[];
  loading: boolean;
  loadError: string | null;
  loaded: boolean;
  onRetry: () => void;
  /** Rejects when the server refuses, so the form can stay open and say why. */
  onSaveBanner: (banner: Banner, isNew: boolean) => Promise<void>;
  onDeleteBanner: (id: string) => Promise<void>;
  onReorder: (id: string, direction: 'up' | 'down') => void;
  onStatusChange: (id: string, newStatus: BannerStatus) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

const STATUS_LABEL: Record<BannerStatus, string> = {
  published: 'Published',
  scheduled: 'Scheduled',
  draft: 'Draft',
  paused: 'Paused',
  archived: 'Archived',
};

const STATUS_HINT: Record<BannerStatus, string> = {
  published: 'In the app now. If you set dates, only between them.',
  scheduled: 'In the app only between the start and end below.',
  draft: 'Not in the app. Publish it when it is ready.',
  paused: 'Not in the app until you publish it again.',
  archived: 'Not in the app.',
};

/** Where the banner stands in the app right now, in one short phrase. */
function showing(banner: Banner, now: Date): { label: string; variant: BadgeVariant } {
  if (isBannerLive(banner, now)) return { label: 'Live in the app', variant: 'success' };
  if (banner.status !== 'published' && banner.status !== 'scheduled') {
    return { label: `${STATUS_LABEL[banner.status] ?? banner.status}, not in the app`, variant: 'neutral' };
  }
  if (banner.status === 'scheduled' && !banner.startsAt) {
    return { label: 'Scheduled with no start, never shows', variant: 'warning' };
  }
  const start = banner.startsAt ? new Date(banner.startsAt) : null;
  if (start && start.getTime() > now.getTime()) return { label: `Starts ${formatWhen(start)}`, variant: 'info' };
  return { label: `Ended ${formatWhen(banner.endsAt) ?? ''}`.trim(), variant: 'neutral' };
}

/** What the app opens when the button is tapped (same rules as the app's `mapCtaHref`). */
function destination(banner: Banner, categories: CategoryOption[]): { text: string; problem?: string } {
  const target = banner.ctaTarget.trim();
  const categoryName = (id: string) =>
    categories.find((c) => String(c.id) === id || c.slug === id)?.name;
  if (target.startsWith('/')) {
    if (target === '/products') return { text: 'All products' };
    const cat = target.match(/^\/category\/([^/?#]+)/);
    if (cat) return { text: categoryName(cat[1]) ?? `Category ${cat[1]}` };
    const prod = target.match(/^\/products\/([^/?#]+)/);
    if (prod) return { text: `Product ${prod[1]}` };
    return { text: `App page ${target}`, problem: "The app may not have this page; check it on a phone." };
  }
  if (banner.ctaType === 'category') {
    const name = categoryName(target);
    if (name) return { text: name };
    return {
      text: `Category ${target || '1'}`,
      problem: categories.length ? 'No category with this id is in the list.' : undefined,
    };
  }
  if (banner.ctaType === 'product') return target ? { text: `Product ${target}` } : { text: 'All products' };
  if (banner.ctaType === 'external') {
    return { text: 'All products', problem: "The app doesn't open outside links, so it shows all products." };
  }
  return { text: 'All products' };
}

type Errors = Partial<Record<'title' | 'imageUrl' | 'ctaLabel' | 'ctaTarget' | 'startsAt' | 'endsAt' | 'form', string>>;

function isImageUrl(value: string): boolean {
  const v = value.trim();
  if (v.startsWith('/')) return v.length > 1;
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function checkBanner(b: Banner): Errors {
  const errors: Errors = {};
  if (!b.title.trim()) errors.title = 'Enter the headline customers will see.';
  if (!b.imageUrl.trim()) errors.imageUrl = 'Upload an image or paste its address.';
  else if (!isImageUrl(b.imageUrl)) errors.imageUrl = 'Use an https:// address or a path starting with /.';
  if (!b.ctaLabel.trim()) errors.ctaLabel = 'Enter the button text, e.g. "Shop now".';
  if (b.ctaType === 'category' && !b.ctaTarget.trim()) errors.ctaTarget = 'Choose the category the button opens.';
  if (b.ctaType === 'product' && !b.ctaTarget.trim()) errors.ctaTarget = 'Enter the product number the button opens.';
  if (b.status === 'scheduled' && !b.startsAt) errors.startsAt = 'A scheduled banner needs a start time.';
  if (b.startsAt && b.endsAt && new Date(b.endsAt).getTime() <= new Date(b.startsAt).getTime()) {
    errors.endsAt = 'End after the start time.';
  }
  return errors;
}

function toLocalInput(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string) {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Remount with `key={src}` so a new address gets a fresh try. */
const BannerImage: React.FC<{ src: string; alt: string; height: number }> = ({ src, alt, height }) => {
  const [failed, setFailed] = useState(false);
  const usable = isImageUrl(src);
  return (
    <div style={{ ...styles.imageBox, height }}>
      {usable && !failed ? (
        <img
          src={resolvePortalAsset(src)}
          alt={alt}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={() => setFailed(true)}
        />
      ) : (
        <div style={styles.imageFallback}>
          <ImageIcon size={26} color="var(--text-dim)" />
          <span>{!src.trim() ? 'No image yet' : usable ? "This image doesn't load" : 'Not an image address'}</span>
        </div>
      )}
    </div>
  );
};

export const BannerCMS: React.FC<BannerCMSProps> = ({
  banners,
  categories,
  loading,
  loadError,
  loaded,
  onRetry,
  onSaveBanner,
  onDeleteBanner,
  onReorder,
  onStatusChange,
  canEdit = true,
  canDelete = true,
}) => {
  const { confirm, dialog } = useConfirm();
  const [filter, setFilter] = useState<'all' | BannerStatus>('all');
  const [editor, setEditor] = useState<{ banner: Banner; isNew: boolean; showErrors: boolean } | null>(null);
  /** Live / starts / ended are worked out as of when the screen opened. */
  const [now] = useState(() => new Date());

  const sorted = [...banners].sort((a, b) => a.position - b.position);
  const shown = filter === 'all' ? sorted : sorted.filter((b) => b.status === filter);
  const liveCount = banners.filter((b) => isBannerLive(b, now)).length;
  const countOf = (status: BannerStatus) => banners.filter((b) => b.status === status).length;

  const stats: StatItem[] = [
    { label: 'Banners', value: loaded ? banners.length : '—', icon: <ImageIcon size={20} />, iconColor: 'var(--accent)' },
    {
      label: 'Live in the app now',
      value: loaded ? liveCount : '—',
      subtext: loaded && liveCount === 0 ? 'The app shows its own built-in slides' : undefined,
      icon: <Play size={20} />,
      iconColor: 'var(--success)',
    },
    {
      label: 'Not in the app',
      value: loaded ? banners.length - liveCount : '—',
      subtext: loaded
        ? [
            [countOf('draft'), 'draft'],
            [countOf('paused'), 'paused'],
            [banners.length - liveCount - countOf('draft') - countOf('paused') - countOf('archived'), 'outside their dates'],
            [countOf('archived'), 'archived'],
          ]
            .filter(([n]) => Number(n) > 0)
            .map(([n, what]) => `${n} ${what}`)
            .join(', ') || undefined
        : undefined,
      icon: <EyeOff size={20} />,
      iconColor: 'var(--warning)',
    },
  ];

  const openNew = () =>
    setEditor({
      isNew: true,
      showErrors: false,
      banner: {
        id: '',
        title: '',
        subtitle: '',
        imageUrl: '',
        ctaLabel: 'Shop now',
        ctaType: 'category',
        ctaTarget: '',
        status: 'draft',
        position: banners.length + 1,
        updatedAt: '',
      },
    });

  const publish = (banner: Banner) => {
    const asPublished = { ...banner, status: 'published' as BannerStatus };
    if (Object.keys(checkBanner(asPublished)).length) {
      setEditor({ isNew: false, showErrors: true, banner: asPublished });
      return;
    }
    onStatusChange(banner.id, 'published');
  };

  const remove = async (banner: Banner) => {
    const ok = await confirm({
      title: `Delete "${banner.title}"?`,
      message:
        'It leaves the app straight away and is deleted for good. To take it out of the app for a while, pause it instead.',
      confirmLabel: 'Delete banner',
      destructive: true,
    });
    if (ok) await onDeleteBanner(banner.id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <StatGrid items={stats} columns={3} />

      <PageIntro
        actions={
          canEdit ? (
            <Button size="sm" icon={<Plus size={14} />} onClick={openNew}>
              Add banner
            </Button>
          ) : undefined
        }
      >
        Banners take turns at the top of the app's home screen, in the order shown here. Every customer sees the same
        banners. When none is live, the app shows its own built-in slides.
        {canEdit ? '' : ' Your role can see banners but not change them.'}
      </PageIntro>

      <LoadState
        loading={loading}
        error={loadError}
        what="banners"
        onRetry={onRetry}
        isEmpty={banners.length === 0}
        empty={{
          icon: <ImageIcon size={22} />,
          title: 'No banners yet',
          description: 'The app shows its own built-in slides until a banner is live.',
          actionLabel: canEdit ? 'Add banner' : undefined,
          onAction: canEdit ? openNew : undefined,
        }}
      >
        <div style={styles.toolbar}>
          <select
            className="tx-input"
            aria-label="Show banners"
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            style={{ width: 'auto' }}
          >
            <option value="all">All banners ({banners.length})</option>
            {(['published', 'scheduled', 'draft', 'paused'] as BannerStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]} ({countOf(s)})
              </option>
            ))}
          </select>
          {filter !== 'all' ? <span style={styles.toolbarNote}>Show all banners to change the order.</span> : null}
        </div>

        {shown.length === 0 ? (
          <p style={styles.toolbarNote}>No {STATUS_LABEL[filter as BannerStatus]?.toLowerCase()} banners.</p>
        ) : (
          <div style={styles.grid}>
            {shown.map((banner, index) => {
              const state = showing(banner, now);
              const goes = destination(banner, categories);
              const from = formatWhen(banner.startsAt);
              const until = formatWhen(banner.endsAt);
              return (
                <article key={banner.id} style={styles.card} aria-label={banner.title}>
                  <div style={{ position: 'relative' }}>
                    <BannerImage key={banner.imageUrl} src={banner.imageUrl} alt="" height={160} />
                    {filter === 'all' ? (
                      <span style={styles.posPill}>
                        {index + 1} of {sorted.length}
                      </span>
                    ) : null}
                  </div>

                  <div style={styles.cardBody}>
                    <div>
                      <Badge variant={state.variant} dot>
                        {state.label}
                      </Badge>
                    </div>
                    <div>
                      <h4 style={styles.cardTitle}>{banner.title}</h4>
                      {banner.subtitle ? <p style={styles.cardSub}>{banner.subtitle}</p> : null}
                    </div>

                    <div style={styles.metaRow}>
                      <span style={styles.metaLine}>
                        <MousePointerClick size={12} />
                        <span>
                          "{banner.ctaLabel}" opens <strong>{goes.text}</strong>
                        </span>
                      </span>
                      {goes.problem ? <span style={styles.problem}>{goes.problem}</span> : null}
                      {from || until ? (
                        <span style={styles.metaLine}>
                          <Calendar size={12} />
                          <span>{from && until ? `${from} to ${until}` : from ? `From ${from}` : `Until ${until}`}</span>
                        </span>
                      ) : null}
                    </div>

                    {canEdit || canDelete ? (
                      <div style={styles.cardActions}>
                        {canEdit && filter === 'all' ? (
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<ArrowUp size={13} />}
                              onClick={() => onReorder(banner.id, 'up')}
                              disabled={index === 0}
                              aria-label={`Move "${banner.title}" earlier`}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<ArrowDown size={13} />}
                              onClick={() => onReorder(banner.id, 'down')}
                              disabled={index === shown.length - 1}
                              aria-label={`Move "${banner.title}" later`}
                            />
                          </div>
                        ) : (
                          <div />
                        )}

                        <div style={{ display: 'flex', gap: '6px' }}>
                          {canEdit ? (
                            <>
                              {banner.status === 'published' || banner.status === 'scheduled' ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  icon={<Pause size={13} />}
                                  onClick={() => onStatusChange(banner.id, 'paused')}
                                >
                                  Pause
                                </Button>
                              ) : (
                                <Button variant="ghost" size="sm" icon={<Play size={13} />} onClick={() => publish(banner)}>
                                  Publish
                                </Button>
                              )}
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={<Edit2 size={13} />}
                                onClick={() => setEditor({ isNew: false, showErrors: false, banner: { ...banner } })}
                              >
                                Edit
                              </Button>
                            </>
                          ) : null}
                          {canDelete ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<Trash2 size={13} color="var(--danger)" />}
                              onClick={() => remove(banner)}
                              aria-label={`Delete "${banner.title}"`}
                            />
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </LoadState>

      {editor ? (
        <BannerDialog
          key={editor.banner.id || 'new'}
          initial={editor.banner}
          isNew={editor.isNew}
          showErrorsAtOnce={editor.showErrors}
          categories={categories}
          onClose={() => setEditor(null)}
          onSave={async (banner) => {
            await onSaveBanner(banner, editor.isNew);
            setEditor(null);
          }}
        />
      ) : null}
      {dialog}
    </div>
  );
};

const BannerDialog: React.FC<{
  initial: Banner;
  isNew: boolean;
  showErrorsAtOnce: boolean;
  categories: CategoryOption[];
  onClose: () => void;
  onSave: (banner: Banner) => Promise<void>;
}> = ({ initial, isNew, showErrorsAtOnce, categories, onClose, onSave }) => {
  const [banner, setBanner] = useState<Banner>(initial);
  const [tried, setTried] = useState(showErrorsAtOnce);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [openedAt] = useState(() => Date.now());

  const errors: Errors = tried ? checkBanner(banner) : {};
  const set = (patch: Partial<Banner>) => {
    setBanner((prev) => ({ ...prev, ...patch }));
    setServerError(null);
  };
  const formId = isNew ? 'banner-new' : `banner-${initial.id}`;
  const endPassed = banner.endsAt && new Date(banner.endsAt).getTime() < openedAt;
  const ctaChoice: CtaType = banner.ctaType;
  const categoryKnown = categories.some((c) => String(c.id) === banner.ctaTarget);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (file.type && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setUploadError('Use a JPEG, PNG or WebP image.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Use an image of 2 MB or less.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const stored = await api.uploadBannerImage(file);
      set({ imageUrl: stored.imageUrl });
    } catch (err) {
      setUploadError(`Not uploaded: ${err instanceof Error ? err.message : "the server didn't answer."}`);
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setTried(true);
    if (Object.keys(checkBanner(banner)).length) return;
    const target =
      banner.ctaType === 'deals' && !banner.ctaTarget.trim().startsWith('/') ? '/products' : banner.ctaTarget.trim();
    try {
      setSaving(true);
      await onSave({
        ...banner,
        title: banner.title.trim(),
        subtitle: banner.subtitle.trim(),
        imageUrl: banner.imageUrl.trim(),
        ctaLabel: banner.ctaLabel.trim(),
        ctaTarget: target,
        startsAt: banner.startsAt ?? '',
        endsAt: banner.endsAt ?? '',
      });
    } catch (err) {
      setServerError(`Not saved: ${err instanceof Error ? err.message : "the server didn't answer."}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isNew ? 'Add banner' : `Edit "${initial.title}"`}
      subtitle="Changes reach the app as soon as they're saved."
      maxWidth="680px"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" type="submit" form={formId} loading={saving} disabled={uploading}>
            {isNew ? 'Add banner' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate style={styles.form}>
        {serverError ? <FormError>{serverError}</FormError> : null}

        <BannerImage key={banner.imageUrl} src={banner.imageUrl} alt="Banner preview" height={170} />

        <Field
          id={`${formId}-upload`}
          label="Upload an image"
          error={uploadError}
          hint={uploading ? 'Uploading…' : 'JPEG, PNG or WebP, up to 2 MB. Fills in the address below.'}
        >
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              void upload(file);
            }}
          />
        </Field>

        <Field
          id={`${formId}-image`}
          label="Image address"
          error={errors.imageUrl}
          hint="Filled in by an upload, or paste an https:// address."
        >
          <input
            value={banner.imageUrl}
            onChange={(e) => set({ imageUrl: e.target.value })}
            placeholder="https://… or /uploads/…"
          />
        </Field>

        <Field id={`${formId}-title`} label="Headline" error={errors.title}>
          <input data-autofocus value={banner.title} onChange={(e) => set({ title: e.target.value })} />
        </Field>

        <Field id={`${formId}-subtitle`} label="Line under the headline" hint="Optional.">
          <input value={banner.subtitle} onChange={(e) => set({ subtitle: e.target.value })} />
        </Field>

        <div style={styles.row}>
          <Field id={`${formId}-cta`} label="Button text" error={errors.ctaLabel} style={{ flex: 1 }}>
            <input value={banner.ctaLabel} onChange={(e) => set({ ctaLabel: e.target.value })} placeholder="Shop now" />
          </Field>
          <Field id={`${formId}-cta-type`} label="Button opens" style={{ flex: 1 }}>
            <select
              value={ctaChoice}
              onChange={(e) => {
                const next = e.target.value as CtaType;
                set({ ctaType: next, ctaTarget: next === 'deals' ? '/products' : '' });
              }}
            >
              <option value="category">A category</option>
              <option value="product">A product</option>
              <option value="deals">All products</option>
              {initial.ctaType === 'external' ? <option value="external">An outside link (not supported)</option> : null}
            </select>
          </Field>
        </div>

        {ctaChoice === 'category' ? (
          <Field id={`${formId}-target`} label="Category" error={errors.ctaTarget}>
            <select value={banner.ctaTarget} onChange={(e) => set({ ctaTarget: e.target.value })}>
              <option value="">Choose a category</option>
              {banner.ctaTarget && !categoryKnown ? (
                <option value={banner.ctaTarget}>Category {banner.ctaTarget} (not in the list)</option>
              ) : null}
              {categories.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        {ctaChoice === 'product' ? (
          <Field
            id={`${formId}-target`}
            label="Product number"
            error={errors.ctaTarget}
            hint="The number at the end of the product's link, e.g. 42."
          >
            <input inputMode="numeric" value={banner.ctaTarget} onChange={(e) => set({ ctaTarget: e.target.value.trim() })} />
          </Field>
        ) : null}
        {ctaChoice === 'external' ? (
          <p style={styles.problem}>
            The app doesn't open outside links; this button shows all products. Choose another option.
          </p>
        ) : null}

        <Field id={`${formId}-status`} label="Status" hint={STATUS_HINT[banner.status]}>
          <select value={banner.status} onChange={(e) => set({ status: e.target.value as BannerStatus })}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="scheduled">Scheduled</option>
            <option value="paused">Paused</option>
          </select>
        </Field>

        <div style={styles.row}>
          <Field
            id={`${formId}-starts`}
            label="Starts"
            error={errors.startsAt}
            hint={banner.status === 'scheduled' ? 'Needed.' : 'Optional.'}
            style={{ flex: 1 }}
          >
            <input
              type="datetime-local"
              value={toLocalInput(banner.startsAt)}
              onChange={(e) => set({ startsAt: fromLocalInput(e.target.value) })}
            />
          </Field>
          <Field
            id={`${formId}-ends`}
            label="Ends"
            error={errors.endsAt}
            hint={endPassed ? "Already passed, so it won't show." : 'Optional. Empty means no end.'}
            style={{ flex: 1 }}
          >
            <input
              type="datetime-local"
              value={toLocalInput(banner.endsAt)}
              onChange={(e) => set({ endsAt: fromLocalInput(e.target.value) })}
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
};

const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: '16px',
  },
  toolbarNote: {
    margin: 0,
    fontSize: '0.8rem',
    color: 'var(--text-dim)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
    gap: '20px',
  },
  card: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: 'var(--shadow-sm)',
  },
  imageBox: {
    position: 'relative',
    background: 'var(--tint-2)',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-md)',
  },
  imageFallback: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '16px',
    fontSize: '0.78rem',
    color: 'var(--text-dim)',
    textAlign: 'center',
  },
  posPill: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    background: 'var(--bg-surface)',
    color: 'var(--text-main)',
    fontSize: '0.72rem',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 'var(--radius-full)',
    border: '1px solid var(--border-subtle)',
  },
  cardBody: {
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    flex: 1,
  },
  cardTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--text-main)',
    margin: '0 0 4px 0',
  },
  cardSub: {
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
    margin: 0,
    lineHeight: 1.4,
  },
  metaRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    marginTop: 'auto',
    paddingTop: '10px',
    borderTop: '1px solid var(--border-subtle)',
  },
  metaLine: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  problem: {
    margin: 0,
    fontSize: '0.76rem',
    color: 'var(--warning)',
  },
  cardActions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '6px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  row: {
    display: 'flex',
    gap: '14px',
    flexWrap: 'wrap',
  },
};
