import React, { useState } from 'react';
import {
  Plus,
  ArrowUp,
  ArrowDown,
  Edit2,
  Trash2,
  Play,
  Pause,
  Calendar,
  Link,
  MapPin,
  Clock,
  Check,
  X,
} from 'lucide-react';
import type { Banner, BannerStatus, CtaType } from '../types';

interface BannerCMSProps {
  banners: Banner[];
  onSaveBanner: (banner: Banner) => void;
  onDeleteBanner: (id: string) => void;
  onReorder: (id: string, direction: 'up' | 'down') => void;
  onStatusChange: (id: string, newStatus: BannerStatus) => void;
  selectedBannerId?: string;
  onSelectBanner: (id: string) => void;
}

export const BannerCMS: React.FC<BannerCMSProps> = ({
  banners,
  onSaveBanner,
  onDeleteBanner,
  onReorder,
  onStatusChange,
  selectedBannerId,
  onSelectBanner,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredBanners = banners
    .filter((b) => (filterStatus === 'all' ? true : b.status === filterStatus))
    .sort((a, b) => a.position - b.position);

  const handleOpenCreate = () => {
    const newBanner: Banner = {
      id: `banner-${Date.now()}`,
      title: 'New Campaign Offer',
      subtitle: 'Exclusive discounts for homeowners and contractors',
      imageUrl: '/images/home-hero-cream.jpg',
      ctaLabel: 'Shop Now',
      ctaType: 'category',
      ctaTarget: '/category/cement-plaster',
      status: 'draft',
      position: banners.length + 1,
      termsText: 'Standard procurement terms apply.',
      locationScope: 'All serviceable zones',
      updatedAt: 'Just now',
    };
    setEditingBanner(newBanner);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (b: Banner) => {
    setEditingBanner({ ...b });
    setIsModalOpen(true);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingBanner) {
      onSaveBanner(editingBanner);
      setIsModalOpen(false);
      setEditingBanner(null);
    }
  };

  const imagePresets = [
    { label: 'Project Essentials (Cream)', url: '/images/home-hero-cream.jpg' },
    { label: 'Diwali Festive Banner', url: '/images/diwali-banner.jpg' },
    { label: 'Bulk Bags & Cement', url: '/images/bulk-bags.jpg' },
    { label: 'General Warehouse Stock', url: '/images/home-banner.jpg' },
  ];

  return (
    <div style={styles.container}>
      {/* Action Bar */}
      <div style={styles.actionBar}>
        {/* Status Filters */}
        <div style={styles.filterPills}>
          {['all', 'published', 'scheduled', 'draft', 'paused'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              style={{
                ...styles.filterBtn,
                ...(filterStatus === status ? styles.filterBtnActive : {}),
              }}
            >
              <span style={{ textTransform: 'capitalize' }}>{status}</span>
              <span style={styles.filterCount}>
                {status === 'all' ? banners.length : banners.filter((b) => b.status === status).length}
              </span>
            </button>
          ))}
        </div>

        {/* Create Button */}
        <button onClick={handleOpenCreate} style={styles.createBtn} className="btn btn-primary">
          <Plus size={16} />
          <span>New Campaign Banner</span>
        </button>
      </div>

      {/* Banner Cards Grid */}
      <div style={styles.bannerGrid}>
        {filteredBanners.map((banner, index) => {
          const isSelected = selectedBannerId === banner.id;
          return (
            <div
              key={banner.id}
              style={{
                ...styles.bannerCard,
                ...(isSelected ? styles.bannerCardSelected : {}),
              }}
              onClick={() => onSelectBanner(banner.id)}
            >
              {/* Thumbnail with overlay status */}
              <div style={styles.thumbnailWrapper}>
                <img
                  src={banner.imageUrl}
                  alt={banner.title}
                  style={styles.thumbnailImg}
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div style={styles.thumbnailOverlay}>
                  <span className={`badge badge-${banner.status}`}>{banner.status}</span>
                  <span style={styles.positionBadge}>Order #{banner.position}</span>
                </div>
              </div>

              {/* Banner Details */}
              <div style={styles.bannerDetails}>
                <div style={styles.cardHeader}>
                  <h3 style={styles.bannerTitle}>{banner.title}</h3>
                  <div style={styles.orderActions}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onReorder(banner.id, 'up');
                      }}
                      disabled={index === 0}
                      style={{ ...styles.iconBtnSmall, opacity: index === 0 ? 0.3 : 1 }}
                      title="Move Up"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onReorder(banner.id, 'down');
                      }}
                      disabled={index === filteredBanners.length - 1}
                      style={{
                        ...styles.iconBtnSmall,
                        opacity: index === filteredBanners.length - 1 ? 0.3 : 1,
                      }}
                      title="Move Down"
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>
                </div>

                <p style={styles.bannerSubtitle}>{banner.subtitle}</p>

                {/* Metadata Pills */}
                <div style={styles.metaRow}>
                  <div style={styles.metaPill}>
                    <Link size={12} color="var(--brand-orange)" />
                    <span>{banner.ctaLabel} ({banner.ctaType})</span>
                  </div>
                  {banner.locationScope && (
                    <div style={styles.metaPill}>
                      <MapPin size={12} color="#38bdf8" />
                      <span>{banner.locationScope}</span>
                    </div>
                  )}
                  {banner.startsAt && (
                    <div style={styles.metaPill}>
                      <Calendar size={12} color="#10b981" />
                      <span>Active Period</span>
                    </div>
                  )}
                </div>

                {banner.termsText && (
                  <p style={styles.termsSnippet}>
                    <strong>Terms:</strong> {banner.termsText}
                  </p>
                )}

                {/* Card Actions Footer */}
                <div style={styles.cardFooter}>
                  <div style={styles.updatedAt}>
                    <Clock size={12} />
                    <span>Updated {banner.updatedAt}</span>
                  </div>

                  <div style={styles.actionButtons}>
                    {banner.status === 'published' ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStatusChange(banner.id, 'paused');
                        }}
                        style={styles.actionBtnWarning}
                        title="Pause Banner"
                      >
                        <Pause size={13} />
                        <span>Pause</span>
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStatusChange(banner.id, 'published');
                        }}
                        style={styles.actionBtnSuccess}
                        title="Publish to Mobile"
                      >
                        <Play size={13} />
                        <span>Publish</span>
                      </button>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEdit(banner);
                      }}
                      style={styles.actionBtnSecondary}
                      title="Edit Campaign"
                    >
                      <Edit2 size={13} />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteBanner(banner.id);
                      }}
                      style={styles.actionBtnDanger}
                      title="Delete Banner"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit / Create Banner Modal */}
      {isModalOpen && editingBanner && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalBox}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                {editingBanner.id.includes(Date.now().toString().slice(0, 5))
                  ? 'Create Campaign Banner'
                  : 'Edit Campaign Banner'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} style={styles.closeBtn}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveModal} style={styles.modalForm}>
              <div style={styles.formGrid}>
                {/* Title */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Headline Title *</label>
                  <input
                    type="text"
                    value={editingBanner.title}
                    onChange={(e) => setEditingBanner({ ...editingBanner, title: e.target.value })}
                    required
                    style={styles.input}
                    placeholder="e.g. Diwali Mega Construction Offer"
                  />
                </div>

                {/* Subtitle */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Subheading / Offer Details *</label>
                  <input
                    type="text"
                    value={editingBanner.subtitle}
                    onChange={(e) => setEditingBanner({ ...editingBanner, subtitle: e.target.value })}
                    required
                    style={styles.input}
                    placeholder="e.g. Up to 15% off on bulk cement & putty"
                  />
                </div>

                {/* CTA Label */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Button CTA Label *</label>
                  <input
                    type="text"
                    value={editingBanner.ctaLabel}
                    onChange={(e) => setEditingBanner({ ...editingBanner, ctaLabel: e.target.value })}
                    required
                    style={styles.input}
                    placeholder="e.g. Shop Now, View Rates"
                  />
                </div>

                {/* CTA Destination Type */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>CTA Target Type</label>
                  <select
                    value={editingBanner.ctaType}
                    onChange={(e) =>
                      setEditingBanner({ ...editingBanner, ctaType: e.target.value as CtaType })
                    }
                    style={styles.select}
                  >
                    <option value="category">Category Route</option>
                    <option value="deals">Deals / Bulk Enquiry</option>
                    <option value="product">Specific Product SKU</option>
                    <option value="external">External Web Link</option>
                  </select>
                </div>

                {/* CTA Target URL / Route */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Target Route / Path *</label>
                  <input
                    type="text"
                    value={editingBanner.ctaTarget}
                    onChange={(e) => setEditingBanner({ ...editingBanner, ctaTarget: e.target.value })}
                    required
                    style={styles.input}
                    placeholder="/category/cement-plaster"
                  />
                </div>

                {/* Status */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Publication Status</label>
                  <select
                    value={editingBanner.status}
                    onChange={(e) =>
                      setEditingBanner({ ...editingBanner, status: e.target.value as BannerStatus })
                    }
                    style={styles.select}
                  >
                    <option value="draft">Draft (Hidden)</option>
                    <option value="published">Published (Live on Mobile)</option>
                    <option value="scheduled">Scheduled (Date range)</option>
                    <option value="paused">Paused (Temporarily disabled)</option>
                  </select>
                </div>
              </div>

              {/* Image Preset Selector */}
              <div style={styles.formGroupFull}>
                <label style={styles.label}>Banner Background Artwork</label>
                <div style={styles.presetGrid}>
                  {imagePresets.map((preset, idx) => (
                    <div
                      key={idx}
                      onClick={() => setEditingBanner({ ...editingBanner, imageUrl: preset.url })}
                      style={{
                        ...styles.presetCard,
                        ...(editingBanner.imageUrl === preset.url ? styles.presetCardActive : {}),
                      }}
                    >
                      <img src={preset.url} alt={preset.label} style={styles.presetImg} />
                      <span style={styles.presetLabel}>{preset.label}</span>
                    </div>
                  ))}
                </div>
                <input
                  type="text"
                  value={editingBanner.imageUrl}
                  onChange={(e) => setEditingBanner({ ...editingBanner, imageUrl: e.target.value })}
                  style={{ ...styles.input, marginTop: '8px' }}
                  placeholder="Or enter custom image URL"
                />
              </div>

              {/* Terms Text */}
              <div style={styles.formGroupFull}>
                <label style={styles.label}>Campaign Terms & Conditions</label>
                <textarea
                  value={editingBanner.termsText || ''}
                  onChange={(e) => setEditingBanner({ ...editingBanner, termsText: e.target.value })}
                  rows={2}
                  style={styles.textarea}
                  placeholder="e.g. Valid on minimum order value of ₹25,000 for verified contractors."
                />
              </div>

              {/* Modal Buttons */}
              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={styles.cancelBtn}
                >
                  Cancel
                </button>
                <button type="submit" style={styles.submitBtn} className="btn btn-primary">
                  <Check size={16} />
                  <span>Save & Sync Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  actionBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
  },
  filterPills: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'var(--bg-surface)',
    padding: '4px',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-subtle)',
  },
  filterBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.8rem',
    fontWeight: 500,
    color: 'var(--text-muted)',
    transition: 'all 0.15s',
  },
  filterBtnActive: {
    background: 'var(--bg-surface-elevated)',
    color: '#fff',
    fontWeight: 600,
    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
  },
  filterCount: {
    padding: '1px 6px',
    borderRadius: 'var(--radius-full)',
    background: 'rgba(255,255,255,0.08)',
    fontSize: '0.7rem',
  },
  createBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  bannerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))',
    gap: '20px',
  },
  bannerCard: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    transition: 'all var(--transition-fast)',
    cursor: 'pointer',
  },
  bannerCardSelected: {
    borderColor: 'var(--brand-orange)',
    boxShadow: '0 0 16px rgba(249, 115, 22, 0.25)',
  },
  thumbnailWrapper: {
    height: '140px',
    width: '100%',
    position: 'relative',
    background: '#0f172a',
    overflow: 'hidden',
  },
  thumbnailImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  thumbnailOverlay: {
    position: 'absolute',
    top: '10px',
    left: '10px',
    right: '10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  positionBadge: {
    background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(6px)',
    padding: '3px 8px',
    borderRadius: 'var(--radius-full)',
    color: '#fff',
    fontSize: '0.72rem',
    fontWeight: 600,
  },
  bannerDetails: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    flex: 1,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '8px',
  },
  bannerTitle: {
    fontSize: '1.05rem',
    fontWeight: 700,
    color: '#fff',
    lineHeight: 1.3,
  },
  orderActions: {
    display: 'flex',
    gap: '4px',
  },
  iconBtnSmall: {
    width: '26px',
    height: '26px',
    borderRadius: '4px',
    background: 'var(--bg-surface-elevated)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  bannerSubtitle: {
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
    lineHeight: 1.4,
  },
  metaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  metaPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '4px 8px',
    borderRadius: 'var(--radius-sm)',
    background: 'rgba(255,255,255,0.04)',
    fontSize: '0.74rem',
    color: 'var(--text-muted)',
    border: '1px solid var(--border-subtle)',
  },
  termsSnippet: {
    fontSize: '0.74rem',
    color: 'var(--text-dim)',
    background: 'rgba(0,0,0,0.2)',
    padding: '6px 10px',
    borderRadius: 'var(--radius-sm)',
  },
  cardFooter: {
    marginTop: 'auto',
    paddingTop: '12px',
    borderTop: '1px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '8px',
  },
  updatedAt: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.72rem',
    color: 'var(--text-dim)',
  },
  actionButtons: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  actionBtnSuccess: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '5px 10px',
    borderRadius: 'var(--radius-sm)',
    background: 'rgba(16, 185, 129, 0.15)',
    color: '#34d399',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  actionBtnWarning: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '5px 10px',
    borderRadius: 'var(--radius-sm)',
    background: 'rgba(251, 191, 36, 0.15)',
    color: '#fbbf24',
    border: '1px solid rgba(251, 191, 36, 0.3)',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  actionBtnSecondary: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '5px 10px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-surface-elevated)',
    color: 'var(--text-main)',
    border: '1px solid var(--border-subtle)',
    fontSize: '0.75rem',
    fontWeight: 500,
    cursor: 'pointer',
  },
  actionBtnDanger: {
    width: '28px',
    height: '28px',
    borderRadius: 'var(--radius-sm)',
    background: 'rgba(244, 63, 94, 0.12)',
    color: '#fb7185',
    border: '1px solid rgba(244, 63, 94, 0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  modalBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: '20px',
  },
  modalBox: {
    background: '#131b2e',
    border: '1px solid var(--border-medium)',
    borderRadius: 'var(--radius-xl)',
    width: '100%',
    maxWidth: '640px',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
  },
  modalHeader: {
    padding: '20px 24px',
    borderBottom: '1px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: '#fff',
  },
  closeBtn: {
    color: 'var(--text-muted)',
    cursor: 'pointer',
  },
  modalForm: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  formGroupFull: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
  input: {
    background: 'var(--bg-app)',
    border: '1px solid var(--border-medium)',
    borderRadius: 'var(--radius-md)',
    padding: '9px 12px',
    color: '#fff',
    outline: 'none',
  },
  select: {
    background: 'var(--bg-app)',
    border: '1px solid var(--border-medium)',
    borderRadius: 'var(--radius-md)',
    padding: '9px 12px',
    color: '#fff',
    outline: 'none',
  },
  textarea: {
    background: 'var(--bg-app)',
    border: '1px solid var(--border-medium)',
    borderRadius: 'var(--radius-md)',
    padding: '9px 12px',
    color: '#fff',
    outline: 'none',
    resize: 'vertical',
  },
  presetGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '10px',
  },
  presetCard: {
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    border: '2px solid transparent',
    background: 'var(--bg-app)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
  },
  presetCardActive: {
    borderColor: 'var(--brand-orange)',
    boxShadow: '0 0 10px rgba(249, 115, 22, 0.4)',
  },
  presetImg: {
    width: '100%',
    height: '55px',
    objectFit: 'cover',
  },
  presetLabel: {
    fontSize: '0.66rem',
    color: 'var(--text-muted)',
    padding: '4px',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '12px',
    paddingTop: '16px',
    borderTop: '1px solid var(--border-subtle)',
  },
  cancelBtn: {
    padding: '9px 16px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-surface-elevated)',
    color: 'var(--text-muted)',
    border: '1px solid var(--border-subtle)',
    fontSize: '0.86rem',
    cursor: 'pointer',
  },
  submitBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
};
