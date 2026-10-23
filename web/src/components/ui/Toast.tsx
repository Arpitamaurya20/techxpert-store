import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { ToastContext, type ToastApi, type ToastTone } from './toastContext';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

/** Errors stay longer: staff need time to read why something failed. */
const DURATION_MS: Record<ToastTone, number> = { success: 4000, info: 4000, error: 8000 };
const MAX_VISIBLE = 4;

const TONE: Record<ToastTone, { color: string; soft: string; icon: React.ReactNode; label: string }> = {
  success: { color: 'var(--success)', soft: 'var(--success-soft)', icon: <CheckCircle2 size={18} />, label: 'Done' },
  error: { color: 'var(--danger)', soft: 'var(--danger-soft)', icon: <AlertCircle size={18} />, label: 'Problem' },
  info: { color: 'var(--info)', soft: 'var(--info-soft)', icon: <Info size={18} />, label: 'Note' },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const id = nextId.current++;
      setItems((prev) => {
        const withoutRepeat = prev.filter((t) => !(t.tone === tone && t.message === message));
        return [...withoutRepeat, { id, tone, message }].slice(-MAX_VISIBLE);
      });
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DURATION_MS[tone])
      );
    },
    [dismiss]
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div style={styles.viewport} aria-live="polite" aria-relevant="additions">
        {items.map((t) => {
          const tone = TONE[t.tone];
          return (
            <div
              key={t.id}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className="toast-enter"
              style={{ ...styles.toast, borderLeftColor: tone.color }}
            >
              <span style={{ ...styles.icon, color: tone.color, background: tone.soft }} aria-hidden="true">
                {tone.icon}
              </span>
              <div style={styles.body}>
                <span style={{ ...styles.label, color: tone.color }}>{tone.label}</span>
                <span style={styles.message}>{t.message}</span>
              </div>
              <button type="button" onClick={() => dismiss(t.id)} style={styles.close} aria-label="Dismiss">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

const styles: Record<string, React.CSSProperties> = {
  viewport: {
    position: 'fixed',
    right: '24px',
    bottom: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    zIndex: 1000,
    width: 'min(380px, calc(100vw - 32px))',
    pointerEvents: 'none',
  },
  toast: {
    pointerEvents: 'auto',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '12px 12px 12px 14px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderLeft: '4px solid',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-lg)',
  },
  icon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '30px',
    height: '30px',
    borderRadius: 'var(--radius-full)',
    flexShrink: 0,
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  message: {
    fontSize: '0.86rem',
    color: 'var(--text-main)',
    lineHeight: 1.4,
    overflowWrap: 'anywhere',
  },
  close: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-dim)',
    flexShrink: 0,
  },
};
