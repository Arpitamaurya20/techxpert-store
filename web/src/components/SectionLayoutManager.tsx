import React from 'react';
import {
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  GripVertical,
  Info,
  RefreshCw,
} from 'lucide-react';
import type { HomepageSection } from '../types';
import { Button } from './ui';

interface SectionLayoutManagerProps {
  sections: HomepageSection[];
  /** Set when the list could not be loaded; nothing else is shown in its place. */
  loadError?: string | null;
  onRetry?: () => void;
  onToggleSection: (id: string) => void;
  onReorderSection: (id: string, direction: 'up' | 'down') => void;
  onResetDefaultOrder: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const SectionLayoutManager: React.FC<SectionLayoutManagerProps> = ({
  sections,
  loadError,
  onRetry,
  onToggleSection,
  onReorderSection,
  onResetDefaultOrder,
  canEdit = true,
  canDelete = true,
}) => {
  const sortedSections = [...sections].sort((a, b) => a.position - b.position);

  if (loadError) {
    return (
      <div style={styles.errorBox}>
        <p style={{ margin: 0 }}>{loadError} Check the connection and try again.</p>
        {onRetry ? (
          <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.infoBanner}>
        <div style={styles.infoIconBox}>
          <Info size={18} color="var(--accent)" />
        </div>
        <div style={styles.infoText}>
          <strong>Phone home order.</strong> This list is the blocks the app can draw. Hidden
          blocks are left out of the public list. Reorder or show one here and the phone follows
          on refresh, without an app release. Search and the header stay above this list.
        </div>
        {canDelete ? (
          <button onClick={onResetDefaultOrder} style={styles.resetBtn}>
            Reset to default layout
          </button>
        ) : null}
      </div>

      {/* Sections Table/List */}
      <div style={styles.sectionList}>
        {sortedSections.map((sec, index) => (
          <div
            key={sec.id}
            style={{
              ...styles.sectionRow,
              opacity: sec.enabled ? 1 : 0.6,
              background: sec.enabled ? 'var(--bg-surface)' : 'var(--bg-surface-elevated)',
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
            {canEdit ? (
              <div style={styles.actionsCol}>
                {/* Visibility Toggle */}
                <button
                  onClick={() => onToggleSection(sec.id)}
                  style={{
                    ...styles.toggleBtn,
                    color: sec.enabled ? 'var(--success)' : 'var(--text-dim)',
                    background: sec.enabled
                      ? 'var(--success-soft)'
                      : 'var(--tint-2)',
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
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '16px',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--danger-border)',
    background: 'var(--danger-soft)',
    color: 'var(--danger)',
    fontSize: '0.88rem',
  },
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
    background: 'var(--accent-soft)',
    border: '1px solid var(--accent-border)',
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
    color: 'var(--accent)',
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
    color: 'var(--text-main)',
  },
  typeTag: {
    fontSize: '0.7rem',
    fontFamily: 'monospace',
    color: 'var(--text-dim)',
    background: 'var(--tint-2)',
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
