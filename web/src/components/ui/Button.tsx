import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: 'var(--accent)',
    color: '#fff',
    border: '1px solid var(--accent)',
    boxShadow: '0 1px 2px var(--accent-border)',
  },
  secondary: {
    background: 'var(--bg-surface)',
    color: 'var(--text-main)',
    border: '1px solid var(--border-medium)',
  },
  outline: {
    background: 'transparent',
    color: 'var(--accent)',
    border: '1px solid var(--accent-border)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-muted)',
    border: 'none',
  },
  danger: {
    background: 'var(--danger-soft)',
    color: 'var(--danger)',
    border: '1px solid var(--danger-border)',
  },
};

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: {
    padding: '6px 12px',
    fontSize: '0.78rem',
    borderRadius: 'var(--radius-sm)',
    gap: '6px',
  },
  md: {
    padding: '9px 16px',
    fontSize: '0.86rem',
    borderRadius: 'var(--radius-md)',
    gap: '8px',
  },
  lg: {
    padding: '12px 22px',
    fontSize: '0.94rem',
    borderRadius: 'var(--radius-md)',
    gap: '10px',
  },
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconRight,
  disabled,
  style,
  ...props
}) => {
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled || loading ? 0.6 : 1,
    transition: 'all var(--transition-fast)',
    ...variantStyles[variant],
    ...sizeStyles[size],
    ...style,
  };

  return (
    <button style={baseStyle} disabled={disabled || loading} {...props}>
      {loading ? (
        <Loader2 size={size === 'sm' ? 14 : 16} className="spin" />
      ) : (
        icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>
      )}
      {children && <span>{children}</span>}
      {!loading && iconRight && <span style={{ display: 'flex', alignItems: 'center' }}>{iconRight}</span>}
    </button>
  );
};
