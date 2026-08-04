import { type ReactNode } from 'react';
import { colors, radius } from '@/design/tokens';

type Variant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

const STYLES: Record<Variant, { bg: string; color: string }> = {
  default:  { bg: colors.surfaceHigh,         color: colors.textSecondary },
  primary:  { bg: 'rgba(21,35,110,0.1)',       color: colors.primary       },
  success:  { bg: colors.successLight,         color: colors.success        },
  warning:  { bg: colors.warningLight,         color: colors.warning        },
  danger:   { bg: colors.errorLight,           color: colors.errorText      },
  info:     { bg: '#dbeafe',                   color: '#1e40af'             },
};

interface BadgeProps {
  variant?: Variant;
  children: ReactNode;
  dot?: boolean;
}

export function Badge({ variant = 'default', children, dot }: BadgeProps) {
  const s = STYLES[variant];
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding: '2px 8px',
      fontSize: '11px',
      fontWeight: 700,
      borderRadius: radius.full,
      background: s.bg,
      color: s.color,
      letterSpacing: '0.01em',
      whiteSpace: 'nowrap',
    }}>
      {dot && (
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: s.color,
          flexShrink: 0,
        }} />
      )}
      {children}
    </span>
  );
}
