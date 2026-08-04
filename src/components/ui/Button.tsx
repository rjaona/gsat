import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { colors, radius, shadow, transition } from '@/design/tokens';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size    = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

const VARIANTS: Record<Variant, { bg: string; color: string; hoverBg: string; shadow?: string }> = {
  primary:   { bg: colors.primary,        color: colors.onPrimary,  hoverBg: colors.primaryHover, shadow: '0 2px 8px rgba(21,35,110,0.25)' },
  secondary: { bg: colors.surfaceHighest, color: colors.text,        hoverBg: colors.surfaceHigh   },
  ghost:     { bg: 'transparent',          color: colors.primary,    hoverBg: colors.primaryMuted  },
  danger:    { bg: colors.errorLight,      color: colors.errorText,  hoverBg: '#ffc4c0'            },
};

const SIZES: Record<Size, { padding: string; fontSize: string; height: string }> = {
  sm: { padding: '0 12px', fontSize: '12px', height: '32px' },
  md: { padding: '0 18px', fontSize: '14px', height: '38px' },
  lg: { padding: '0 24px', fontSize: '14px', height: '44px' },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, icon, children, disabled, style, ...props }, ref) => {
    const v = VARIANTS[variant];
    const s = SIZES[size];
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: s.padding,
          height: s.height,
          fontSize: s.fontSize,
          fontWeight: 600,
          fontFamily: "'Inter', sans-serif",
          background: v.bg,
          color: v.color,
          borderRadius: size === 'lg' ? radius.xl : radius.lg,
          border: 'none',
          boxShadow: v.shadow,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          opacity: isDisabled ? 0.5 : 1,
          transition: `background ${transition.fast}, transform ${transition.fast}, box-shadow ${transition.fast}`,
          userSelect: 'none',
          whiteSpace: 'nowrap',
          ...style,
        }}
        onMouseEnter={e => {
          if (isDisabled) return;
          const el = e.currentTarget;
          el.style.background = v.hoverBg;
          el.style.transform = 'translateY(-1px)';
          if (v.shadow) el.style.boxShadow = shadow.md;
        }}
        onMouseLeave={e => {
          const el = e.currentTarget;
          el.style.background = v.bg;
          el.style.transform = 'translateY(0)';
          el.style.boxShadow = v.shadow ?? 'none';
        }}
        onMouseDown={e => { if (!isDisabled) e.currentTarget.style.transform = 'translateY(0)'; }}
        onMouseUp={e => { if (!isDisabled) e.currentTarget.style.transform = 'translateY(-1px)'; }}
        {...props}
      >
        {loading ? (
          <span style={{
            width: 14,
            height: 14,
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
            flexShrink: 0,
            display: 'inline-block',
          }} />
        ) : icon ? (
          <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{icon}</span>
        ) : null}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
