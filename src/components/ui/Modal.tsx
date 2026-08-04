import { useEffect, type ReactNode } from 'react';
import { colors, radius, shadow } from '@/design/tokens';

interface ModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const widths = { sm: '440px', md: '560px', lg: '720px' };

export function Modal({ title, subtitle, onClose, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'rgba(23,28,34,0.5)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="animate-fadeIn w-full"
        style={{
          maxWidth: widths[size],
          background: colors.surface,
          borderRadius: radius.xl,
          boxShadow: shadow.xl,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: `1px solid ${colors.border}`,
        }}>
          <div>
            <h3 style={{
              fontSize: '16px',
              fontWeight: 700,
              fontFamily: "'Manrope', sans-serif",
              color: colors.text,
              margin: 0,
            }}>
              {title}
            </h3>
            {subtitle && (
              <p style={{ fontSize: '12px', color: colors.textMuted, marginTop: '2px' }}>{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.md,
              border: 'none',
              background: 'transparent',
              color: colors.textMuted,
              cursor: 'pointer',
              transition: 'background 120ms',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = colors.surfaceHigh}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            aria-label="Fermer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>{children}</div>

        {/* Footer */}
        {footer && (
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            padding: '16px 24px',
            borderTop: `1px solid ${colors.border}`,
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
