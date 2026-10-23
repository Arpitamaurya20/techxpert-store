import React, { useEffect, useMemo, useState } from 'react';
import {
  Image as ImageIcon,
  Plus,
  ArrowUp,
  ArrowDown,
  Edit2,
  Trash2,
  Play,
  Pause,
  MapPin,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import type { Banner, BannerStatus, CtaType } from '../types';
import { api, resolvePortalAsset } from '../services/api';
import { StatGrid, Badge, Button, Modal } from './ui';
import type { StatItem, BadgeVariant } from './ui';

interface BannerCMSProps {
  banners: Banner[];
  onSaveBanner: (banner: Banner) => void;
  onDeleteBanner: (id: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  onReorder: (id: string, direction: 'up' | 'down') => void;
  onStatusChange: (id: string, newStatus: BannerStatus) => void;
  selectedBannerId?: string;
  onSelectBanner: (id: string) => void;
}

const statusMap: Record<BannerStatus, { variant: BadgeVariant; label: string }> = {
  published: { variant: 'success', label: 'Published' },
  scheduled: { variant: 'info', label: 'Scheduled' },
  draft: { variant: 'neutral', label: 'Draft' },
  paused: { variant: 'warning', label: 'Paused' },
  archived: { variant: 'danger', label: 'Archived' },
};

const CTA_HINTS: Record<CtaType, { label: string; placeholder: string; example: string }> = {
  category: {
    label: 'Category ID or slug',
    placeholder: 'e.g. 1 or cement-plaster',
    example: 'Opens category browse on mobile',
  },
  product: {
    label: 'Product ID or SKU',
    placeholder: 'e.g. 42 or TX-1204',
    example: 'Deep-links to product detail',
  },
  external: {
    label: 'External HTTPS URL',
    placeholder: 'https://…',
    example: 'Opens in browser / in-app webview',
  },
  deals: {
    label: 'Deals route (optional)',
    placeholder: '/deals or leave blank',
    example: 'Defaults to in-app deals rail',
  },
};

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function isImageUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (v.startsWith('/')) return true; // site-relative asset
  return isHttpUrl(v);
}

function validateBanner(banner: Banner): string[] {
  const errors: string[] = [];

  if (!banner.title.trim()) errors.push('Headline is required.');
  if (!isImageUrl(banner.imageUrl)) {
    errors.push('Image URL must be https://… or a site path starting with /.');
  }
  if (!banner.ctaLabel.trim()) errors.push('CTA button label is required.');

  const target = banner.ctaTarget.trim();
  switch (banner.ctaType) {
    case 'category':
    case 'product':
      if (!target) errors.push(`CTA target is required for ${banner.ctaType} links.`);
      break;
    case 'external':
      if (!isHttpUrl(target)) errors.push('External CTA must be a full http(s) URL.');
      break;
    case 'deals':
      if (target && !target.startsWith('/') && !isHttpUrl(target)) {
        errors.push('Deals target should be a path like /deals or a full URL.');
      }
      break;
  }

  if (banner.status === 'published' && errors.length === 0 && !isImageUrl(banner.imageUrl)) {
    errors.push('Cannot publish without a valid image URL.');
  }

  if (banner.status === 'scheduled' && !banner.startsAt) {
    errors.push('Scheduled banners need a start time. The phone stays on the previous campaign until then.');
  }
  if (banner.startsAt && banner.endsAt && new Date(banner.endsAt).getTime() < new Date(banner.startsAt).getTime()) {
    errors.push('End time must be on or after the start time.');
  }

  return errors;
}

function toLocalInput(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

function formatWindow(banner: Banner) {
  const start = banner.startsAt ? new Date(banner.startsAt) : null;
  const end = banner.endsAt ? new Date(banner.endsAt) : null;
  const fmt = (d: Date) =>
    d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `From ${fmt(start)}`;
  if (end) return `Until ${fmt(end)}`;
  return '';
}

const BannerImagePreview: React.FC<{
  src: string;
  alt: string;
  height?: number;
  showUrlStatus?: boolean;
}> = ({ src, alt, height = 170, showUrlStatus = false }) => {
  const [failed, setFailed] = useState(false);
  const displaySrc = resolvePortalAsset(src);
  const validShape = isImageUrl(src);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <div>
      <div
        style={{
          position: 'relative',
          height,
          background: '#0f172a',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {validShape && !failed ? (
          <img
            src={displaySrc}
            alt={alt}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={() => setFailed(true)}
            onLoad={() => setFailed(false)}
          />
        ) : (
          <div style={styles.imageFallback}>
            <ImageIcon size={28} color="var(--text-dim)" />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textAlign: 'center' }}>
              {!src.trim()
                ? 'Paste an image URL to preview'
                : !validShape
                  ? 'Invalid URL format'
                  : 'Image failed to load'}
            </span>
          </div>
        )}
      </div>
      {showUrlStatus && (
        <div style={styles.urlStatusRow}>
          {validShape && !failed ? (
            <>
              <CheckCircle2 size={13} color="#10b981" />
              <span style={{ color: '#10b981' }}>Preview OK — image loads</span>
            </>
          ) : (
            <>
              <AlertCircle size={13} color="#f59e0b" />
              <span style={{ color: '#f59e0b' }}>
                {!validShape ? 'Fix URL format before publish' : 'Broken or unreachable image'}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export const BannerCMS: React.FC<BannerCMSProps> = ({
  banners,
  onSaveBanner,
  onDeleteBanner,
  canEdit = true,
  canDelete = true,
  onReorder,
  onStatusChange,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [triedSave, setTriedSave] = useState(false);

  const activeCount = banners.filter((b) => b.status === 'published').length;
  const scheduledCount = banners.filter((b) => b.status === 'scheduled').length;
  const draftCount = banners.filter((b) => b.status === 'draft').length;

  const stats: StatItem[] = [
    {
      label: 'Campaign Banners',
      value: banners.length,
      icon: <ImageIcon size={20} />,
      iconColor: 'var(--brand-orange)',
    },
    {
      label: 'Published on Mobile App',
      value: activeCount,
      icon: <Play size={20} />,
      iconColor: '#10b981',
    },
    {
      label: 'Scheduled Campaigns',
      value: scheduledCount,
      icon: <Calendar size={20} />,
      iconColor: '#38bdf8',
    },
    {
      label: 'Draft / Paused',
      value: draftCount + banners.filter((b) => b.status === 'paused').length,
      icon: <Pause size={20} />,
      iconColor: '#f59e0b',
    },
  ];

  const filteredBanners = banners
    .filter((b) => (filterStatus === 'all' ? true : b.status === filterStatus))
    .sort((a, b) => a.position - b.position);

  const liveErrors = useMemo(
    () => (editingBanner ? validateBanner(editingBanner) : []),
    [editingBanner]
  );

  const ctaHint = editingBanner ? CTA_HINTS[editingBanner.ctaType] : CTA_HINTS.category;

  const handleOpenCreate = () => {
    setEditingBanner({
      id: `banner-${Date.now()}`,
      title: 'New Campaign Offer',
      subtitle: 'Exclusive discounts for homeowners and trade contractors',
      imageUrl: '',
      ctaLabel: 'Shop Now',
      ctaType: 'category',
      ctaTarget: '',
      status: 'draft',
      position: banners.length + 1,
      termsText: 'Standard trade procurement terms apply.',
      locationScope: 'All serviceable zones',
      updatedAt: new Date().toISOString().slice(0, 10),
    });
    setFormErrors([]);
    setTriedSave(false);
    setUploadError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (banner: Banner) => {
    setEditingBanner({ ...banner });
    setFormErrors([]);
    setTriedSave(false);
    setUploadError(null);
    setIsModalOpen(true);
  };

  const handleUploadImage = async (file: File | undefined) => {
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (file.type && !allowed.includes(file.type)) {
      setUploadError('Use a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Image must be 2 MB or smaller.');
      return;
    }
    setUploadingImage(true);
    setUploadError(null);
    try {
      const stored = await api.uploadBannerImage(file);
      setEditingBanner((current) => (current ? { ...current, imageUrl: stored.imageUrl } : current));
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Could not store that image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveModal = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!editingBanner) return;

    const errors = validateBanner(editingBanner);
    setTriedSave(true);
    setFormErrors(errors);
    if (errors.length > 0) return;

    const normalized: Banner = {
      ...editingBanner,
      title: editingBanner.title.trim(),
      subtitle: editingBanner.subtitle.trim(),
      imageUrl: editingBanner.imageUrl.trim(),
      ctaLabel: editingBanner.ctaLabel.trim(),
      ctaTarget:
        editingBanner.ctaType === 'deals' && !editingBanner.ctaTarget.trim()
          ? '/deals'
          : editingBanner.ctaTarget.trim(),
      updatedAt: new Date().toISOString().slice(0, 10),
    };

    onSaveBanner(normalized);
    setIsModalOpen(false);
    setEditingBanner(null);
    setFormErrors([]);
    setTriedSave(false);
  };

  const showErrors = triedSave ? formErrors : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <StatGrid items={stats} />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={styles.select}
        >
          <option value="all">All Campaign Statuses ({banners.length})</option>
          <option value="published">Published</option>
          <option value="scheduled">Scheduled</option>
          <option value="draft">Draft</option>
          <option value="paused">Paused</option>
        </select>

        {canEdit ? (
          <Button variant="primary" size="sm" icon={<Plus size={16} />} onClick={handleOpenCreate}>
            New Campaign Banner
          </Button>
        ) : null}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: '20px',
        }}
      >
        {filteredBanners.map((banner, index) => {
          const s = statusMap[banner.status] || {
            variant: 'neutral' as BadgeVariant,
            label: banner.status,
          };
          return (
            <div key={banner.id} style={styles.card}>
              <div style={{ position: 'relative' }}>
                <BannerImagePreview src={banner.imageUrl} alt={banner.title} height={170} />
                <div style={styles.cardBadges}>
                  <Badge variant={s.variant} dot>
                    {s.label}
                  </Badge>
                  <span style={styles.posPill}>#{banner.position}</span>
                </div>
              </div>

              <div style={styles.cardBody}>
                <div>
                  <h4 style={styles.cardTitle}>{banner.title}</h4>
                  {banner.subtitle && <p style={styles.cardSub}>{banner.subtitle}</p>}
                </div>

                <div style={styles.metaRow}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={12} color="var(--brand-orange)" />
                    <span>{banner.locationScope || 'All zones'}</span>
                  </div>
                  {formatWindow(banner) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} color="var(--brand-orange)" />
                      <span>{formatWindow(banner)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {banner.ctaType === 'external' && <ExternalLink size={11} />}
                    <span>
                      CTA: <strong>{banner.ctaLabel}</strong>
                      <span style={{ color: 'var(--text-dim)' }}> · {banner.ctaType}</span>
                    </span>
                  </div>
                </div>

                {canEdit || canDelete ? (
                  <div style={styles.cardActions}>
                    {canEdit ? (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<ArrowUp size={13} />}
                          onClick={() => onReorder(banner.id, 'up')}
                          disabled={index === 0}
                          title="Move up"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<ArrowDown size={13} />}
                          onClick={() => onReorder(banner.id, 'down')}
                          disabled={index === filteredBanners.length - 1}
                          title="Move down"
                        />
                      </div>
                    ) : <div />}

                    <div style={{ display: 'flex', gap: '8px' }}>
                      {canEdit ? (
                        <>
                          {banner.status === 'published' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<Pause size={13} />}
                              onClick={() => onStatusChange(banner.id, 'paused')}
                            >
                              Pause
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<Play size={13} />}
                              onClick={() => {
                                const errors = validateBanner({ ...banner, status: 'published' });
                                if (errors.length > 0) {
                                  window.alert(
                                    `Cannot publish "${banner.title}":\n\n• ${errors.join('\n• ')}\n\nOpen Edit to fix image URL / CTA first.`
                                  );
                                  return;
                                }
                                onStatusChange(banner.id, 'published');
                              }}
                            >
                              Publish
                            </Button>
                          )}
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<Edit2 size={13} />}
                            onClick={() => handleOpenEdit(banner)}
                          >
                            Edit
                          </Button>
                        </>
                      ) : null}
                      {canDelete ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 size={13} color="#f43f5e" />}
                          onClick={() => {
                            if (window.confirm(`Delete banner "${banner.title}"?`)) {
                              onDeleteBanner(banner.id);
                            }
                          }}
                        />
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && editingBanner && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingBanner.id.startsWith('banner-') ? 'Create Campaign Banner' : 'Edit Campaign Banner'}
          subtitle="Live image preview + CTA validation before publish to mobile home"
          maxWidth="680px"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleSaveModal()}
                disabled={triedSave && liveErrors.length > 0}
              >
                Save Banner
              </Button>
            </>
          }
        >
          <form onSubmit={handleSaveModal} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {showErrors.length > 0 && (
              <div style={styles.errorBox}>
                <AlertCircle size={16} color="#f43f5e" />
                <ul style={styles.errorList}>
                  {showErrors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <BannerImagePreview
              src={editingBanner.imageUrl}
              alt={editingBanner.title || 'Banner preview'}
              height={180}
              showUrlStatus
            />

            <div>
              <label style={styles.label}>Campaign image</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploadingImage}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  void handleUploadImage(file);
                }}
                style={{ ...styles.input, colorScheme: 'dark' }}
              />
              <p style={styles.hint}>
                {uploadingImage
                  ? 'Storing the image…'
                  : 'JPEG, PNG, or WebP, up to 2 MB. The banner keeps the stored address.'}
              </p>
              {uploadError && (
                <p style={{ ...styles.hint, color: '#f43f5e' }}>{uploadError}</p>
              )}
            </div>

            <div>
              <label style={styles.label}>Image URL *</label>
              <input
                type="text"
                value={editingBanner.imageUrl}
                onChange={(e) => setEditingBanner({ ...editingBanner, imageUrl: e.target.value })}
                style={{
                  ...styles.input,
                  borderColor:
                    triedSave && !isImageUrl(editingBanner.imageUrl)
                      ? 'rgba(244, 63, 94, 0.6)'
                      : 'var(--border-subtle)',
                }}
                placeholder="https://cdn.example.com/hero.jpg or /images/home-banner.jpg"
                required
              />
              <p style={styles.hint}>
                An upload fills this in. A CDN URL still works. Stored files use <code>/uploads/…</code> and
                the phone loads them from the API.
              </p>
            </div>

            <div>
              <label style={styles.label}>Banner Headline / Title *</label>
              <input
                type="text"
                value={editingBanner.title}
                onChange={(e) => setEditingBanner({ ...editingBanner, title: e.target.value })}
                style={styles.input}
                required
              />
            </div>

            <div>
              <label style={styles.label}>Subtitle / Campaign Copy</label>
              <input
                type="text"
                value={editingBanner.subtitle || ''}
                onChange={(e) => setEditingBanner({ ...editingBanner, subtitle: e.target.value })}
                style={styles.input}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={styles.label}>CTA Button Label *</label>
                <input
                  type="text"
                  value={editingBanner.ctaLabel}
                  onChange={(e) => setEditingBanner({ ...editingBanner, ctaLabel: e.target.value })}
                  style={styles.input}
                  placeholder="Shop Now"
                />
              </div>

              <div>
                <label style={styles.label}>Status</label>
                <select
                  value={editingBanner.status}
                  onChange={(e) =>
                    setEditingBanner({ ...editingBanner, status: e.target.value as BannerStatus })
                  }
                  style={{ ...styles.select, width: '100%' }}
                >
                  <option value="draft" style={{ background: '#0f172a' }}>
                    Draft
                  </option>
                  <option value="scheduled" style={{ background: '#0f172a' }}>
                    Scheduled
                  </option>
                  <option value="published" style={{ background: '#0f172a' }}>
                    Published
                  </option>
                  <option value="paused" style={{ background: '#0f172a' }}>
                    Paused
                  </option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={styles.label}>Starts</label>
                <input
                  type="datetime-local"
                  value={toLocalInput(editingBanner.startsAt)}
                  onChange={(e) =>
                    setEditingBanner({ ...editingBanner, startsAt: fromLocalInput(e.target.value) || undefined })
                  }
                  style={{ ...styles.input, colorScheme: 'dark' }}
                />
              </div>
              <div>
                <label style={styles.label}>Ends</label>
                <input
                  type="datetime-local"
                  value={toLocalInput(editingBanner.endsAt)}
                  onChange={(e) =>
                    setEditingBanner({ ...editingBanner, endsAt: fromLocalInput(e.target.value) || undefined })
                  }
                  style={{ ...styles.input, colorScheme: 'dark' }}
                />
              </div>
            </div>
            <p style={{ ...styles.hint, marginTop: '-6px' }}>
              Leave both empty for a published banner to stay on the phone until you pause it. A scheduled
              banner appears only between these times.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={styles.label}>CTA Type *</label>
                <select
                  value={editingBanner.ctaType}
                  onChange={(e) =>
                    setEditingBanner({
                      ...editingBanner,
                      ctaType: e.target.value as CtaType,
                      ctaTarget: '',
                    })
                  }
                  style={{ ...styles.select, width: '100%' }}
                >
                  <option value="category" style={{ background: '#0f172a' }}>
                    Category
                  </option>
                  <option value="product" style={{ background: '#0f172a' }}>
                    Product
                  </option>
                  <option value="deals" style={{ background: '#0f172a' }}>
                    Deals rail
                  </option>
                  <option value="external" style={{ background: '#0f172a' }}>
                    External URL
                  </option>
                </select>
              </div>

              <div>
                <label style={styles.label}>
                  {ctaHint.label}
                  {editingBanner.ctaType !== 'deals' ? ' *' : ''}
                </label>
                <input
                  type="text"
                  value={editingBanner.ctaTarget}
                  onChange={(e) => setEditingBanner({ ...editingBanner, ctaTarget: e.target.value })}
                  style={styles.input}
                  placeholder={ctaHint.placeholder}
                />
                <p style={styles.hint}>{ctaHint.example}</p>
              </div>
            </div>

            <div>
              <label style={styles.label}>Serviceable Delivery Location Scope</label>
              <input
                type="text"
                value={editingBanner.locationScope || ''}
                onChange={(e) => setEditingBanner({ ...editingBanner, locationScope: e.target.value })}
                style={styles.input}
                placeholder="e.g. All serviceable zones, NCR & Western UP"
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  label: {
    display: 'block',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: '6px',
  },
  hint: {
    margin: '6px 0 0',
    fontSize: '0.72rem',
    color: 'var(--text-dim)',
    lineHeight: 1.4,
  },
  select: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: '8px 12px',
    color: '#fff',
    fontSize: '0.84rem',
    outline: 'none',
    cursor: 'pointer',
  },
  input: {
    width: '100%',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: '9px 14px',
    color: '#fff',
    fontSize: '0.86rem',
    outline: 'none',
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
  cardBadges: {
    position: 'absolute',
    top: '12px',
    left: '12px',
    display: 'flex',
    gap: '8px',
    zIndex: 1,
  },
  posPill: {
    background: 'rgba(0, 0, 0, 0.7)',
    color: '#fff',
    fontSize: '0.72rem',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 'var(--radius-full)',
  },
  cardBody: {
    padding: '18px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    flex: 1,
  },
  cardTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#fff',
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
    color: 'var(--text-dim)',
    marginTop: 'auto',
    paddingTop: '8px',
    borderTop: '1px solid var(--border-subtle)',
  },
  cardActions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '10px',
  },
  imageFallback: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '16px',
  },
  urlStatusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '8px',
    fontSize: '0.74rem',
    fontWeight: 600,
  },
  errorBox: {
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-start',
    padding: '12px 14px',
    borderRadius: 'var(--radius-md)',
    background: 'rgba(244, 63, 94, 0.1)',
    border: '1px solid rgba(244, 63, 94, 0.35)',
  },
  errorList: {
    margin: 0,
    paddingLeft: '18px',
    color: '#fda4af',
    fontSize: '0.82rem',
    lineHeight: 1.5,
  },
};
