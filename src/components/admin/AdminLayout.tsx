import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users, Building2, BookOpen } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

export function AdminLayout() {
  const { t } = useTranslation();
  const { role } = useAuthStore();

  if (role !== 'admin_global') {
    return <Navigate to="/dashboard" replace />;
  }

  const tabs = [
    { to: '/admin/utilisateurs', icon: Users,     label: t('admin.nav.utilisateurs') },
    { to: '/admin/organisations', icon: Building2, label: t('admin.nav.organisations') },
    { to: '/admin/referentiel',   icon: BookOpen,  label: t('admin.nav.referentiel') },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100%', flexDirection: 'column' }}>
      {/* ── En-tête module admin ── */}
      <div
        style={{
          padding: '20px 28px 0',
          background: 'var(--surface-container-lowest)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <p
          className="label-caps"
          style={{ marginBottom: '2px' }}
        >
          Administration
        </p>
        <h1
          style={{
            fontSize: '22px',
            fontWeight: 800,
            fontFamily: 'var(--font-headline)',
            color: 'var(--text)',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            marginBottom: '16px',
          }}
        >
          {t('admin.titre')}
        </h1>

        {/* Sous-navigation tabs */}
        <nav
          style={{ display: 'flex', gap: '4px' }}
          aria-label={t('admin.nav.label')}
        >
          {tabs.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                padding: '8px 16px',
                borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
                fontSize: '13px',
                fontWeight: isActive ? 700 : 500,
                textDecoration: 'none',
                transition: 'background 150ms ease, color 150ms ease',
                background: isActive
                  ? 'var(--bg)'
                  : 'transparent',
                color: isActive
                  ? 'var(--primary)'
                  : 'var(--text-secondary)',
                borderBottom: isActive
                  ? '2px solid var(--primary)'
                  : '2px solid transparent',
                marginBottom: '-1px',
              })}
              onMouseOver={e => {
                const el = e.currentTarget;
                if (!el.getAttribute('aria-current')) {
                  el.style.background = 'var(--surface-container-low)';
                  el.style.color = 'var(--text)';
                }
              }}
              onMouseOut={e => {
                const el = e.currentTarget;
                if (!el.getAttribute('aria-current')) {
                  el.style.background = 'transparent';
                  el.style.color = 'var(--text-secondary)';
                }
              }}
            >
              <Icon size={14} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* ── Contenu ── */}
      <div style={{ flex: 1, padding: '28px' }}>
        <Outlet />
      </div>
    </div>
  );
}
