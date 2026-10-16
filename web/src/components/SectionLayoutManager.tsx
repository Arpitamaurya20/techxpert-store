import React from 'react';
import {
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  GripVertical,
  Info,
} from 'lucide-react';
import type { HomepageSection } from '../types';

interface SectionLayoutManagerProps {
  sections: HomepageSection[];
  onToggleSection: (id: string) => void;
  onReorderSection: (id: string, direction: 'up' | 'down') => void;
  onResetDefaultOrder: () => void;
}

export const SectionLayoutManager: React.FC<SectionLayoutManagerProps> = ({
  sections,
  onToggleSection,
  onReorderSection,
  onResetDefaultOrder,
}) => {
  const sortedSections = [...sections].sort((a, b) => a.position - b.position);

  return (
    <div style={styles.container}>
      {/* Informational banner from SRS */}
      <div style={styles.infoBanner}>
        <div style={styles.infoIconBox}>
          <Info size={18} color="var(--brand-orange)" />
        </div>
        <div style={styles.infoText}>
          <strong>Dynamic CMS-Driven Ordering:</strong> As specified in{' '}
          <code>SRS Section 6 & 8.4</code>, the customer mobile app requests homepage
          configuration dynamically from the backend and renders sections in this exact order.
          No mobile app store release is required when you reorder or toggle sections here.
        </div>
        <button onClick={onResetDefaultOrder} style={styles.resetBtn}>
          Reset to SRS Defaults
        </button>
      </div>

      {/* Sections Table/List */}
      <div style={styles.sectionList}>
        {sortedSections.map((sec, index) => (
          <div
            key={sec.id}
            style={{
              ...styles.sectionRow,
              opacity: sec.enabled ? 1 : 0.6,
              background: sec.enabled ? 'var(--bg-surface)' : 'rgba(19, 27, 46, 0.4)',
            }}
          >
            {/* Drag / Position indicator */}
            <div style={styles.positionCol}>
              <GripVertical size={16} color="var(--text-dim)" />
              <span style={styles.positionNumber}>#{sec.position}</span>
            </div>

            {/* Title & Description */}
            <div style={styles.contentCol}>
              <div style={styles.titleLine}>
                <span style={styles.sectionTitle}>{sec.title}</span>
                <span style={styles.typeTag}>type: {sec.type}</span>
                {sec.enabled ? (
                  <span className="badge badge-published">Active</span>
                ) : (
                  <span className="badge badge-draft">Disabled</span>
                )}
              </div>
              <p style={styles.sectionDesc}>{sec.description}</p>
            </div>

            {/* Actions */}
            <div style={styles.actionsCol}>
              {/* Visibility Toggle */}
              <button
                onClick={() => onToggleSection(sec.id)}
                style={{
                  ...styles.toggleBtn,
                  color: sec.enabled ? '#10b981' : 'var(--text-dim)',
                  background: sec.enabled
                    ? 'rgba(16, 185, 129, 0.12)'
                    : 'rgba(255, 255, 255, 0.05)',
                }}
                title={sec.enabled ? 'Hide Section' : 'Show Section'}
              >
                {sec.enabled ? <Eye size={16} /> : <EyeOff size={16} />}
                <span>{sec.enabled ? 'Visible' : 'Hidden'}</span>
              </button>

              {/* Order buttons */}
              <div style={styles.orderBtns}>
                <button
                  onClick={() => onReorderSection(sec.id, 'up')}
                  disabled={index === 0}
                  style={{
                    ...styles.orderBtn,
                    opacity: index === 0 ? 0.3 : 1,
                  }}
                  title="Move Up"
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  onClick={() => onReorderSection(sec.id, 'down')}
                  disabled={index === sortedSections.length - 1}
                  style={{
                    ...styles.orderBtn,
                    opacity: index === sortedSections.length - 1 ? 0.3 : 1,
                  }}
                  title="Move Down"
                >
                  <ArrowDown size={15} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  infoBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '16px 20px',
    background: 'rgba(249, 115, 22, 0.06)',
    border: '1px solid rgba(249, 115, 22, 0.2)',
    borderRadius: 'var(--radius-lg)',
  },
  infoIconBox: {
    flexShrink: 0,
  },
  infoText: {
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
    lineHeight: 1.5,
    flex: 1,
  },
  resetBtn: {
    padding: '7px 12px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-surface-elevated)',
    border: '1px solid var(--border-medium)',
    color: 'var(--text-main)',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
  },
  sectionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  sectionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px 20px',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-subtle)',
    transition: 'all var(--transition-fast)',
  },
  positionCol: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '60px',
    flexShrink: 0,
  },
  positionNumber: {
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    fontSize: '0.9rem',
    color: 'var(--brand-orange)',
  },
  contentCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  titleLine: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  sectionTitle: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: '#fff',
  },
  typeTag: {
    fontSize: '0.7rem',
    fontFamily: 'monospace',
    color: 'var(--text-dim)',
    background: 'rgba(255,255,255,0.04)',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  sectionDesc: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
  },
  actionsCol: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexShrink: 0,
  },
  toggleBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-subtle)',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  orderBtns: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  orderBtn: {
    width: '32px',
    height: '32px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-surface-elevated)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-main)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
};
