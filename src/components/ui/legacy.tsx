import { forwardRef, type ReactNode } from 'react';
import { colors, radius, shadow, font, transition } from '@/design/tokens';

// ── EmptyState ─────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '64px 32px',
      textAlign: 'center',
    }}>
      {icon && (
        <div style={{
          width: 56,
          height: 56,
          borderRadius: radius.xl,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
          background: colors.surfaceLow,
          color: colors.primary,
        }}>
          {icon}
        </div>
      )}
      <p style={{
        fontSize: '16px',
        fontWeight: 700,
        fontFamily: font.headline,
        color: colors.text,
        margin: '0 0 8px',
      }}>
        {title}
      </p>
      {description && (
        <p style={{
          fontSize: '14px',
          color: colors.textSecondary,
          marginBottom: 24,
          maxWidth: 280,
          lineHeight: 1.6,
        }}>
          {description}
        </p>
      )}
      {action}
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-lg ${className}`}
      style={{
        background: colors.surfaceHigh,
        animation: 'shimmer 1.5s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

// ── SearchInput ────────────────────────────────────────────────────────────────

interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function SearchInput({ value, onChange, placeholder = 'Rechercher…' }: SearchInputProps) {
  return (
    <div style={{ position: 'relative' }}>
      <svg
        style={{
          position: 'absolute',
          left: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 16,
          height: 16,
          pointerEvents: 'none',
          color: colors.textMuted,
        }}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      <input
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          paddingLeft: 36,
          paddingRight: 16,
          paddingTop: 8,
          paddingBottom: 8,
          fontSize: '14px',
          fontFamily: font.body,
          background: colors.surfaceHighest,
          border: `2px solid transparent`,
          borderRadius: radius.lg,
          color: colors.text,
          outline: 'none',
          transition: `border-color ${transition.fast}, background ${transition.fast}`,
        }}
        onFocus={e => {
          e.currentTarget.style.borderColor = colors.primary;
          e.currentTarget.style.background = colors.surface;
        }}
        onBlur={e => {
          e.currentTarget.style.borderColor = 'transparent';
          e.currentTarget.style.background = colors.surfaceHighest;
        }}
      />
    </div>
  );
}

// ── FormField ──────────────────────────────────────────────────────────────────

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}

export function FormField({ label, htmlFor, error, required, hint, children }: FormFieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label
        htmlFor={htmlFor}
        style={{
          fontSize: '11px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: error ? colors.error : colors.textSecondary,
        }}
      >
        {label}
        {required && <span style={{ color: colors.error, marginLeft: 4 }}>*</span>}
      </label>
      {children}
      {hint && !error && (
        <p style={{ fontSize: '12px', color: colors.textMuted }}>{hint}</p>
      )}
      {error && (
        <p style={{ fontSize: '12px', fontWeight: 500, color: colors.error }}>{error}</p>
      )}
    </div>
  );
}

// ── Select ─────────────────────────────────────────────────────────────────────

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ style, children, ...props }, ref) => (
  <select
    ref={ref}
    style={{
      width: '100%',
      padding: '10px 40px 10px 16px',
      fontSize: '14px',
      fontFamily: font.body,
      background: colors.surfaceHighest,
      border: `2px solid transparent`,
      borderRadius: radius.lg,
      color: colors.text,
      outline: 'none',
      appearance: 'none',
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23767682' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 12px center',
      transition: `border-color ${transition.fast}, background ${transition.fast}`,
      cursor: 'pointer',
      ...style,
    }}
    onFocus={e => {
      e.currentTarget.style.borderColor = colors.primary;
      e.currentTarget.style.background = colors.surface;
    }}
    onBlur={e => {
      e.currentTarget.style.borderColor = 'transparent';
      e.currentTarget.style.background = colors.surfaceHighest;
    }}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';

// ── PageHeader ─────────────────────────────────────────────────────────────────

interface PageHeaderProps {
  label?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ label, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 16,
      marginBottom: 24,
    }}>
      <div>
        {label && (
          <span style={{
            display: 'block',
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: colors.textMuted,
            marginBottom: 8,
          }}>
            {label}
          </span>
        )}
        <h1 style={{
          fontSize: '24px',
          fontWeight: 800,
          fontFamily: font.headline,
          color: colors.text,
          margin: 0,
          letterSpacing: '-0.02em',
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: '14px', color: colors.textSecondary, marginTop: 4 }}>{subtitle}</p>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginTop: 4 }}>
          {actions}
        </div>
      )}
    </div>
  );
}

// ── SectionHeader ──────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  label?: string;
  title: string;
  action?: ReactNode;
}

export function SectionHeader({ label, title, action }: SectionHeaderProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    }}>
      <div>
        {label && (
          <span style={{
            display: 'block',
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: colors.textMuted,
            marginBottom: 4,
          }}>
            {label}
          </span>
        )}
        <h2 style={{
          fontSize: '16px',
          fontWeight: 700,
          fontFamily: font.headline,
          color: colors.text,
          margin: 0,
        }}>
          {title}
        </h2>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ── DataTable ──────────────────────────────────────────────────────────────────

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  skeletonRows?: number;
  getKey: (row: T) => string;
  emptyState?: ReactNode;
}

export function DataTable<T>({
  columns, data, loading, skeletonRows = 5, getKey, emptyState,
}: DataTableProps<T>) {
  const tableWrapStyle: React.CSSProperties = {
    background: colors.surface,
    boxShadow: shadow.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
  };
  const theadStyle: React.CSSProperties = {
    background: colors.surfaceLow,
  };
  const thStyle: React.CSSProperties = {
    padding: '12px 24px',
    textAlign: 'left',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: colors.textMuted,
    borderBottom: `1px solid ${colors.border}`,
  };
  const tdStyle: React.CSSProperties = {
    padding: '14px 24px',
    fontSize: '14px',
    color: colors.text,
  };

  if (loading) {
    return (
      <div style={tableWrapStyle}>
        <table style={{ minWidth: '100%', borderCollapse: 'collapse' }}>
          <thead style={theadStyle}>
            <tr>
              {columns.map(col => (
                <th key={col.key} style={{ ...thStyle, width: col.width }}>{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: skeletonRows }).map((_, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${colors.border}` }}>
                {columns.map(col => (
                  <td key={col.key} style={tdStyle}>
                    <Skeleton className="h-4" style={{ width: `${50 + (i * 13) % 40}%`, height: 16 }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (data.length === 0 && emptyState) {
    return <div style={tableWrapStyle}>{emptyState}</div>;
  }

  return (
    <div style={tableWrapStyle}>
      <table style={{ minWidth: '100%', borderCollapse: 'collapse' }}>
        <thead style={theadStyle}>
          <tr>
            {columns.map(col => (
              <th key={col.key} style={{ ...thStyle, width: col.width }}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={getKey(row)}
              style={{
                borderTop: i > 0 ? `1px solid ${colors.border}` : undefined,
                transition: `background ${transition.base}`,
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = colors.surfaceLow}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              {columns.map(col => (
                <td key={col.key} style={tdStyle}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Pagination ─────────────────────────────────────────────────────────────────

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, pageSize, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 4px',
    }}>
      <span style={{ fontSize: '12px', color: colors.textMuted }}>
        {from}–{to} / {total}
      </span>
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => (
          <button
            key={i}
            onClick={() => onChange(i)}
            style={{
              width: 32,
              height: 32,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: radius.full,
              border: 'none',
              cursor: 'pointer',
              transition: `background ${transition.fast}`,
              background: i === page ? colors.primary : 'transparent',
              color: i === page ? '#fff' : colors.textSecondary,
            }}
            onMouseEnter={e => {
              if (i !== page) (e.currentTarget as HTMLElement).style.background = colors.surfaceHigh;
            }}
            onMouseLeave={e => {
              if (i !== page) (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── StatCard ───────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  subLabel?: string;
  trend?: { value: number; label?: string };
  icon?: ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
}

const STAT_VARIANTS = {
  default:  { bg: colors.surface,       accent: colors.primary    },
  primary:  { bg: colors.primaryMuted,  accent: colors.primary    },
  success:  { bg: colors.successLight,  accent: colors.success    },
  warning:  { bg: colors.warningLight,  accent: colors.warning    },
  danger:   { bg: colors.errorLight,    accent: colors.errorText  },
};

export function StatCard({ label, value, subLabel, trend, icon, variant = 'default' }: StatCardProps) {
  const v = STAT_VARIANTS[variant];
  const trendUp = trend && trend.value > 0;
  const trendDown = trend && trend.value < 0;

  return (
    <div style={{
      borderRadius: radius.lg,
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      background: v.bg,
      boxShadow: shadow.card,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{
          fontSize: '11px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: colors.textMuted,
        }}>
          {label}
        </span>
        {icon && (
          <span style={{ color: v.accent, opacity: 0.7 }}>{icon}</span>
        )}
      </div>
      <div>
        <p style={{
          fontSize: '30px',
          fontWeight: 800,
          fontFamily: font.headline,
          color: v.accent,
          lineHeight: 1,
          letterSpacing: '-0.02em',
        }}>
          {value}
        </p>
        {subLabel && (
          <p style={{ fontSize: '12px', color: colors.textMuted, marginTop: 4 }}>{subLabel}</p>
        )}
        {trend && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
            <span style={{
              fontSize: '12px',
              fontWeight: 700,
              color: trendUp ? colors.success : trendDown ? colors.error : colors.textMuted,
            }}>
              {trendUp ? '↑' : trendDown ? '↓' : '→'} {Math.abs(trend.value)}%
            </span>
            {trend.label && (
              <span style={{ fontSize: '12px', color: colors.textMuted }}>{trend.label}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
