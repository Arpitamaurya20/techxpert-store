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
  MapPin,
  Calendar,
} from 'lucide-react';
import type { Banner, BannerStatus } from '../types';
import { StatGrid, Badge, Button, Modal } from './ui';
import type { StatItem, BadgeVariant } from './ui';


interface BannerCMSProps {
  banners: Banner[];
  onSaveBanner: (banner: Banner) => void;
  onDeleteBanner: (id: string) => void;
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

export const BannerCMS: React.FC<BannerCMSProps> = ({
  banners,
  onSaveBanner,
  onDeleteBanner,
  onReorder,
  onStatusChange,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const handleOpenCreate = () => {
    setEditingBanner({
      id: `banner-${Date.now()}`,
      title: 'New Campaign Offer',
      subtitle: 'Exclusive discounts for homeowners and trade contractors',
      imageUrl: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80',
      ctaLabel: 'Shop Now',
      ctaType: 'category',
      ctaTarget: '1',
      status: 'published',
      position: banners.length + 1,
      termsText: 'Standard trade procurement terms apply.',
      locationScope: 'All serviceable zones',
      updatedAt: new Date().toISOString().slice(0, 10),
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (banner: Banner) => {
    setEditingBanner({ ...banner });
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Metric Cards */}
      <StatGrid items={stats} />

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
        </div>

        <Button variant="primary" size="sm" icon={<Plus size={16} />} onClick={handleOpenCreate}>
          New Campaign Banner
        </Button>
      </div>

      {/* Banner Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
        {filteredBanners.map((banner, index) => {
          const s = statusMap[banner.status] || { variant: 'neutral' as BadgeVariant, label: banner.status };
          return (
            <div
              key={banner.id}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: 'var(--shadow-sm)',
                transition: 'all var(--transition-fast)',
              }}
            >
              {/* Image Preview */}
              <div style={{ position: 'relative', height: '170px', background: '#0f172a' }}>
                <img
                  src={banner.imageUrl}
                  alt={banner.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', gap: '8px' }}>
                  <Badge variant={s.variant} dot>
                    {s.label}
                  </Badge>
                  <span
                    style={{
                      background: 'rgba(0, 0, 0, 0.7)',
                      color: '#fff',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      backdropFilter: 'blur(4px)',
                    }}
                  >
                    #{banner.position}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', margin: '0 0 4px 0' }}>
                    {banner.title}
                  </h4>
                  {banner.subtitle && (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                      {banner.subtitle}
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={12} color="var(--brand-orange)" />
                    <span>{banner.locationScope || 'All zones'}</span>
                  </div>
                  <div>CTA: <strong>{banner.ctaLabel}</strong></div>
                </div>

                {/* Card Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
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

                  <div style={{ display: 'flex', gap: '8px' }}>
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
                        onClick={() => onStatusChange(banner.id, 'published')}
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
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 size={13} color="#f43f5e" />}
                      onClick={() => onDeleteBanner(banner.id)}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && editingBanner && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingBanner.id.startsWith('banner-') ? 'Create Campaign Banner' : 'Edit Campaign Banner'}
          subtitle="Configures homepage hero banner and CTA deep link target"
          maxWidth="600px"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveModal}>
                Save Banner
              </Button>
            </>
          }
        >
          <form onSubmit={handleSaveModal} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={styles.label}>Banner Headline / Title</label>
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

            <div>
              <label style={styles.label}>Image URL</label>
              <input
                type="url"
                value={editingBanner.imageUrl}
                onChange={(e) => setEditingBanner({ ...editingBanner, imageUrl: e.target.value })}
                style={styles.input}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={styles.label}>CTA Button Label</label>
                <input
                  type="text"
                  value={editingBanner.ctaLabel}
                  onChange={(e) => setEditingBanner({ ...editingBanner, ctaLabel: e.target.value })}
                  style={styles.input}
                />
              </div>

              <div>
                <label style={styles.label}>Status</label>
                <select
                  value={editingBanner.status}
                  onChange={(e) => setEditingBanner({ ...editingBanner, status: e.target.value as BannerStatus })}
                  style={styles.select}
                >
                  <option value="published" style={{ background: '#0f172a' }}>Published</option>
                  <option value="scheduled" style={{ background: '#0f172a' }}>Scheduled</option>
                  <option value="draft" style={{ background: '#0f172a' }}>Draft</option>
                  <option value="paused" style={{ background: '#0f172a' }}>Paused</option>
                </select>
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
};
