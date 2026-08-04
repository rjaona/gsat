import { type ReactNode, type CSSProperties } from 'react';
import { colors, radius, shadow, transition } from '@/design/tokens';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  accent?: 'primary' | 'success' | 'warning' | 'danger';
  style?: CSSProperties;
}

const ACCENTS = {
  primary: colors.primary,
  success: colors.secondary,
  warning: '#f59e0b',
  danger:  colors.error,
};

export function Card({ children, className = '', padding = 'md', hover, accent, style }: CardProps) {
  const padMap = { none: '0', sm: '16px', md: '20px', lg: '24px' };

  return (
    <div
      className={className}
      style={{
        background: colors.surface,
        borderRadius: radius.lg,
        boxShadow: shadow.card,
        padding: padMap[padding],
        borderLeft: accent ? `3px solid ${ACCENTS[accent]}` : undefined,
        transition: hover ? `box-shadow ${transition.base}, transform ${transition.base}` : undefined,
        ...style,
      }}
      onMouseEnter={hover ? e => {
        (e.currentTarget as HTMLElement).style.boxShadow = shadow.md;
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
      } : undefined}
      onMouseLeave={hover ? e => {
        (e.currentTarget as HTMLElement).style.boxShadow = shadow.card;
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
      } : undefined}
    >
      {children}
    </div>
  );
}
