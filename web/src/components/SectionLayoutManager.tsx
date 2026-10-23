import React from 'react';
import { ArrowUp, ArrowDown, Eye, EyeOff, LayoutList, RotateCcw } from 'lucide-react';
import type { HomepageSection } from '../types';
import { Badge, Button, LoadState, PageIntro, useConfirm } from './ui';

interface SectionLayoutManagerProps {
  sections: HomepageSection[];
  loading: boolean;
  loadError: string | null;
  loaded: boolean;
  onRetry: () => void;
  onToggleSection: (id: string) => void;
  onReorderSection: (id: string, direction: 'up' | 'down') => void;
  onResetDefaultOrder: () => void;
  canEdit?: boolean;
  /** Resetting the layout needs delete rights. */
  canDelete?: boolean;
}

export const SectionLayoutManager: React.FC<SectionLayoutManagerProps> = ({
  sections,
  loading,
  loadError,
  loaded,
  onRetry,
  onToggleSection,
  onReorderSection,
  onResetDefaultOrder,
  canEdit = true,
  canDelete = true,
}) => {
  const { confirm, dialog } = useConfirm();
  const sorted = [...sections].sort((a, b) => a.position - b.position);
  const shownCount = sections.filter((s) => s.enabled).length;

  const reset = async () => {
    const ok = await confirm({
      title: 'Reset the home screen layout?',
      message:
        'Every block goes back to the standard order, hidden blocks are shown again, and their names and descriptions go back to the standard ones. The app picks this up the next time it loads the home screen.',
      confirmLabel: 'Reset layout',
    });
    if (ok) onResetDefaultOrder();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PageIntro
        actions={
          canDelete && loaded ? (
            <Button variant="secondary" size="sm" icon={<RotateCcw size={14} />} onClick={reset}>
              Reset layout
            </Button>
          ) : undefined
        }
      >
        Listed top to bottom as they appear in the app, which picks up a change the next time it loads the home
        screen. Search and the header always stay above these blocks.
        {loaded ? ` ${shownCount} of ${sections.length} blocks are shown.` : ''}
        {canEdit ? '' : ' Your role can see the layout but not change it.'}
      </PageIntro>

      <LoadState
        loading={loading}
        error={loadError}
        what="the home screen layout"
        onRetry={onRetry}
        isEmpty={sections.length === 0}
        empty={{
          icon: <LayoutList size={22} />,
          title: 'No blocks to show',
          description: 'The server returned no home screen blocks.',
        }}
      >
        <ol style={styles.list}>
          {sorted.map((sec, index) => (
            <li key={sec.id} style={{ ...styles.row, ...(sec.enabled ? {} : styles.rowHidden) }}>
              <span style={styles.position} aria-hidden>
                {index + 1}
              </span>

              <div style={styles.content}>
                <div style={styles.titleLine}>
                  <span style={styles.title}>{sec.title}</span>
                  <Badge variant={sec.enabled ? 'success' : 'neutral'} size="sm">
                    {sec.enabled ? 'Shown' : 'Hidden'}
                  </Badge>
                </div>
                {sec.description ? <p style={styles.description}>{sec.description}</p> : null}
              </div>

              {canEdit ? (
                <div style={styles.actions}>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={sec.enabled ? <EyeOff size={14} /> : <Eye size={14} />}
                    onClick={() => onToggleSection(sec.id)}
                    aria-label={`${sec.enabled ? 'Hide' : 'Show'} "${sec.title}"`}
                  >
                    {sec.enabled ? 'Hide' : 'Show'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<ArrowUp size={14} />}
                    onClick={() => onReorderSection(sec.id, 'up')}
                    disabled={index === 0}
                    aria-label={`Move "${sec.title}" up`}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<ArrowDown size={14} />}
                    onClick={() => onReorderSection(sec.id, 'down')}
                    disabled={index === sorted.length - 1}
                    aria-label={`Move "${sec.title}" down`}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      </LoadState>
      {dialog}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '14px 18px',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-subtle)',
    background: 'var(--bg-surface)',
  },
  rowHidden: {
    background: 'var(--tint-2)',
  },
  position: {
    width: '28px',
    height: '28px',
    flexShrink: 0,
    borderRadius: 'var(--radius-full)',
    background: 'var(--accent-soft)',
    color: 'var(--accent)',
    fontWeight: 700,
    fontSize: '0.82rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    minWidth: 0,
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
  title: {
    fontSize: '0.92rem',
    fontWeight: 700,
    color: 'var(--text-main)',
  },
  description: {
    margin: 0,
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flexShrink: 0,
  },
};
