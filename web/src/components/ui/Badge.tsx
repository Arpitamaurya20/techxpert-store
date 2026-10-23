import React from 'react';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  dot?: boolean;
  style?: React.CSSProperties;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string; border: string; dot: string }> = {
  success: {
    bg: 'var(--success-soft)',
    text: 'var(--success)',
    border: 'var(--success-border)',
    dot: 'var(--success)',
  },
  warning: {
    bg: 'var(--warning-soft)',
    text: 'var(--warning)',
    border: 'var(--warning-border)',
    dot: 'var(--warning)',
  },
  danger: {
    bg: 'var(--danger-soft)',
    text: 'var(--danger)',
    border: 'var(--danger-border)',
    dot: 'var(--danger)',
  },
  info: {
    bg: 'var(--info-soft)',
    text: 'var(--info)',
    border: 'var(--info-border)',
    dot: 'var(--info)',
  },
  neutral: {
    bg: 'var(--tint-3)',
    text: 'var(--text-muted)',
    border: 'var(--tint-3)',
    dot: 'var(--text-muted)',
  },
  brand: {
    bg: 'var(--accent-soft)',
    text: 'var(--accent)',
    border: 'var(--accent-border)',
    dot: 'var(--accent)',
  },
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  icon,
  dot,
  style,
}) => {
  const v = variantStyles[variant] || variantStyles.neutral;
  const isSm = size === 'sm';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isSm ? '4px' : '6px',
        padding: isSm ? '2px 8px' : '4px 10px',
        borderRadius: 'var(--radius-full)',
        background: v.bg,
        color: v.text,
        border: `1px solid ${v.border}`,
        fontSize: isSm ? '0.7rem' : '0.76rem',
        fontWeight: 600,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
        ...style,
      }}
    >
      {dot && (
        <span
          style={{
            width: isSm ? '5px' : '6px',
            height: isSm ? '5px' : '6px',
            borderRadius: '50%',
            background: v.dot,
            boxShadow: `0 0 6px ${v.dot}`,
          }}
        />
      )}
      {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
