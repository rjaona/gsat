import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationStore } from '@/stores/notificationStore'

interface NavItem {
  to: string
  icon: string
  labelKey: string
  badge?: number | undefined
  roles?: string[] | undefined
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard/asn',    icon: 'domain',        labelKey: 'nav.asnLevel' },
  { to: '/dashboard/faritany', icon: 'insights',    labelKey: 'nav.faritanyLevel' },
  { to: '/dashboard/osn',    icon: 'public',        labelKey: 'nav.osnLevel' },
  { to: '/dashboard/global', icon: 'language',      labelKey: 'nav.globalLevel' },
  { to: '/evaluation',       icon: 'assignment',    labelKey: 'nav.evaluation' },
  { to: '/action-plan',      icon: 'moving',        labelKey: 'nav.actionPlan' },
  { to: '/tracking',         icon: 'track_changes', labelKey: 'nav.tracking' },
]

const ADMIN_ITEMS: NavItem[] = [
  { to: '/admin/cycles',         icon: 'event_repeat',    labelKey: 'nav.cycles',         roles: ['admin_global', 'responsable_region'] },
  { to: '/admin/revue',          icon: 'fact_check',      labelKey: 'nav.revue',          roles: ['admin_global', 'responsable_osn', 'responsable_region'] },
  { to: '/admin/users',          icon: 'manage_accounts', labelKey: 'nav.users',          roles: ['admin_global'] },
  { to: '/admin/organisations',  icon: 'corporate_fare',  labelKey: 'nav.organisations',  roles: ['admin_global'] },
  { to: '/admin/referential',    icon: 'menu_book',       labelKey: 'nav.referential',    roles: ['admin_global'] },
  { to: '/admin/workflow',       icon: 'account_tree',    labelKey: 'nav.workflow',        roles: ['admin_global', 'responsable_region'] },
  { to: '/admin/audit',          icon: 'history',         labelKey: 'nav.auditLog',       roles: ['admin_global', 'responsable_region'] },
]

const AI_ITEMS: NavItem[] = [
  { to: '/ai-assistant', icon: 'auto_awesome', labelKey: 'nav.aiAssistant' },
]

const UTILITY_ITEMS: NavItem[] = [
  { to: '/notifications',  icon: 'notifications', labelKey: 'nav.notifications' },
  { to: '/settings',       icon: 'settings',      labelKey: 'nav.settings' },
]

function SideNavLink({ item }: { item: NavItem }) {
  const { t } = useTranslation()
  const location = useLocation()
  const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + '/')

  return (
    <NavLink
      to={item.to}
      className={[
        'group flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm relative',
        'transition-all duration-200',
        isActive
          ? 'bg-wosm-purple-container text-wosm-purple font-semibold shadow-sm'
          : 'text-on-surface-variant hover:bg-wosm-purple-container/50 hover:text-wosm-purple font-medium',
      ].join(' ')}
      aria-current={isActive ? 'page' : undefined}
    >
      {/* Active indicator bar */}
      {isActive && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-wosm-purple"
          aria-hidden="true"
        />
      )}

      <span
        className={[
          'material-symbols-outlined text-[20px] shrink-0 transition-colors duration-200',
          isActive
            ? 'text-wosm-purple'
            : 'text-outline group-hover:text-wosm-purple-light',
        ].join(' ')}
      >
        {item.icon}
      </span>

      <span className="flex-1 truncate">{t(item.labelKey)}</span>

      {/* Notification badge */}
      {item.badge != null && item.badge > 0 && (
        <span className="ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-wosm-yellow text-wosm-on-yellow-container text-[10px] font-bold leading-none">
          {item.badge}
        </span>
      )}
    </NavLink>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 pt-4 pb-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-outline select-none">
      {children}
    </p>
  )
}

export function Sidebar() {
  const { t } = useTranslation()
  const role = useAuthStore(s => s.role)
  const unreadCount = useNotificationStore(s => s.unreadCount)

  const visibleAdminItems = ADMIN_ITEMS.filter(
    item => !item.roles || (role && item.roles.includes(role))
  )

  return (
    <aside className="h-screen w-64 fixed left-0 top-0 bg-surface-container-low flex flex-col p-3 pt-20 z-40 border-r border-outline-variant/20">
      {/* Brand block */}
      <div className="px-4 mb-5">
        <div className="flex items-center gap-2.5">
          {/* WOSM mini-fleur-de-lis badge */}
          <div className="w-8 h-8 rounded-lg bg-wosm-purple flex items-center justify-center shrink-0">
            <svg viewBox="0 0 32 32" width="18" height="18" fill="none" aria-hidden="true">
              <path
                d="M16 2L5 7v8c0 7 4.7 13.5 11 15.5C22.3 28.5 27 22 27 15V7L16 2z"
                fill="#FDB714"
              />
              <text
                x="16" y="19"
                textAnchor="middle"
                fontSize="6"
                fontWeight="bold"
                fill="#4B2E83"
                fontFamily="system-ui, sans-serif"
              >
                G
              </text>
            </svg>
          </div>
          <div>
            <h2 className="font-headline font-bold text-wosm-purple text-[15px] leading-tight tracking-tight">
              GSAT Portal
            </h2>
            <p className="text-[10px] text-outline font-medium mt-0.5 tracking-wide uppercase">
              {t('brand.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto" aria-label={t('nav.groupModules')}>
        <SectionLabel>{t('nav.groupModules')}</SectionLabel>
        {NAV_ITEMS.map((item) => (
          <SideNavLink key={item.to} item={item} />
        ))}

        {visibleAdminItems.length > 0 && (
          <>
            {/* Section separator */}
            <div className="my-3 mx-4" aria-hidden="true">
              <div className="h-px bg-gradient-to-r from-transparent via-wosm-purple-muted to-transparent" />
            </div>

            <SectionLabel>{t('nav.groupAdmin')}</SectionLabel>
            {visibleAdminItems.map((item) => (
              <SideNavLink key={item.to} item={item} />
            ))}
          </>
        )}

        {/* Section separator */}
        <div className="my-3 mx-4" aria-hidden="true">
          <div className="h-px bg-gradient-to-r from-transparent via-wosm-purple-muted to-transparent" />
        </div>

        <SectionLabel>{t('nav.groupAi')}</SectionLabel>
        {AI_ITEMS.map((item) => (
          <SideNavLink key={item.to} item={item} />
        ))}

        {/* Section separator */}
        <div className="my-3 mx-4" aria-hidden="true">
          <div className="h-px bg-gradient-to-r from-transparent via-wosm-purple-muted to-transparent" />
        </div>

        {UTILITY_ITEMS.map((item) => (
          <SideNavLink
            key={item.to}
            item={
              item.to === '/notifications'
                ? { ...item, badge: unreadCount > 0 ? unreadCount : undefined }
                : item
            }
          />
        ))}
      </nav>

      {/* CTA — WOSM gradient */}
      <div className="pt-4 px-1 shrink-0">
        <NavLink
          to="/evaluation/new"
          className="btn-wosm w-full py-3 px-4 rounded-lg flex items-center justify-center gap-2 font-headline font-bold text-sm"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          {t('nav.newEvaluation')}
        </NavLink>
      </div>
    </aside>
  )
}
