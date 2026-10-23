import React from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { EmptyState } from './EmptyState';

interface LoadStateProps {
  loading: boolean;
  error?: string | null;
  /** Plural noun for the messages: "delivery pincodes" → "Loading delivery pincodes…". */
  what: string;
  onRetry?: () => void;
  /** No rows to show. While there are rows, a reload or failure keeps them on screen. */
  isEmpty: boolean;
  empty: {
    title: string;
    description: string;
    icon?: React.ReactNode;
    actionLabel?: string;
    onAction?: () => void;
  };
  children: React.ReactNode;
}

/** Loading, "Couldn't load" with Retry, or empty with a next step; otherwise the content. */
export const LoadState: React.FC<LoadStateProps> = ({
  loading,
  error,
  what,
  onRetry,
  isEmpty,
  empty,
  children,
}) => {
  const failure = error ? (
    <div role="alert" style={styles.error}>
      <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>Couldn't load {what}.</div>
        <div style={styles.errorDetail}>
          {isEmpty ? error : `${error} Showing what was loaded before.`}
        </div>
      </div>
      {onRetry ? (
        <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={onRetry} loading={loading}>
          Retry
        </Button>
      ) : null}
    </div>
  ) : null;

  if (isEmpty && loading && !error) {
    return (
      <div role="status" style={styles.loading}>
        <Loader2 size={18} className="spin" />
        Loading {what}…
      </div>
    );
  }
  if (isEmpty && failure) return failure;
  if (isEmpty) return <EmptyState {...empty} />;

  return (
    <>
      {failure}
      {children}
    </>
  );
};

const styles: Record<string, React.CSSProperties> = {
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '40px 16px',
    color: 'var(--text-muted)',
    fontSize: '0.86rem',
  },
  error: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '12px 14px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--danger-soft)',
    border: '1px solid var(--danger-border)',
    color: 'var(--danger)',
    fontSize: '0.84rem',
  },
  errorDetail: {
    marginTop: '2px',
    color: 'var(--text-muted)',
    fontSize: '0.8rem',
    wordBreak: 'break-word',
  },
};
