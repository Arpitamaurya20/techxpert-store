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
    bg: 'rgba(16, 185, 129, 0.12)',
    text: '#10b981',
    border: 'rgba(16, 185, 129, 0.25)',
    dot: '#10b981',
  },
  warning: {
    bg: 'rgba(245, 158, 11, 0.12)',
    text: '#f59e0b',
    border: 'rgba(245, 158, 11, 0.25)',
    dot: '#f59e0b',
  },
  danger: {
    bg: 'rgba(244, 63, 94, 0.12)',
    text: '#f43f5e',
    border: 'rgba(244, 63, 94, 0.25)',
    dot: '#f43f5e',
  },
  info: {
    bg: 'rgba(56, 189, 248, 0.12)',
    text: '#38bdf8',
    border: 'rgba(56, 189, 248, 0.25)',
    dot: '#38bdf8',
  },
  neutral: {
    bg: 'rgba(255, 255, 255, 0.08)',
    text: '#94a3b8',
    border: 'rgba(255, 255, 255, 0.12)',
    dot: '#94a3b8',
  },
  brand: {
    bg: 'rgba(249, 115, 22, 0.12)',
    text: 'var(--brand-orange)',
    border: 'rgba(249, 115, 22, 0.25)',
    dot: 'var(--brand-orange)',
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
