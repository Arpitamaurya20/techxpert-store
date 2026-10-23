import React from 'react';

interface FieldProps {
  /** Links the label to the control; also used for the hint and error ids. */
  id: string;
  label: string;
  /** Short help under the control, shown when there is no error. */
  hint?: string;
  error?: string | null;
  /** A single input, select or textarea; it receives the shared `tx-input` style. */
  children: React.ReactElement<React.InputHTMLAttributes<HTMLElement>>;
  style?: React.CSSProperties;
}

/** Label, then the control, then its hint or error. */
export const Field: React.FC<FieldProps> = ({ id, label, hint, error, children, style }) => {
  const noteId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const control = React.cloneElement(children, {
    id,
    className: ['tx-input', children.props.className].filter(Boolean).join(' '),
    'aria-invalid': error ? true : undefined,
    'aria-describedby': noteId,
  });

  return (
    <div style={{ ...styles.field, ...style }}>
      <label htmlFor={id} style={styles.label}>
        {label}
      </label>
      {control}
      {error ? (
        <p id={noteId} role="alert" style={styles.error}>
          {error}
        </p>
      ) : hint ? (
        <p id={noteId} style={styles.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  );
};

/** A form-level problem that belongs to no single field, e.g. the server refused the save. */
export const FormError: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p role="alert" style={styles.formError}>
    {children}
  </p>
);

const styles: Record<string, React.CSSProperties> = {
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minWidth: 0,
  },
  label: {
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
  hint: {
    margin: 0,
    fontSize: '0.74rem',
    color: 'var(--text-dim)',
  },
  error: {
    margin: 0,
    fontSize: '0.76rem',
    color: 'var(--danger)',
  },
  formError: {
    margin: 0,
    padding: '8px 12px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--danger-soft)',
    border: '1px solid var(--danger-border)',
    color: 'var(--danger)',
    fontSize: '0.82rem',
  },
};
