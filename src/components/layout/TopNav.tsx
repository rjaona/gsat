import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationStore } from '@/stores/notificationStore'

export function TopNav() {
  const { i18n } = useTranslation()
  const { profile } = useAuthStore()
  const unreadCount = useNotificationStore(s => s.unreadCount)

  const langs = ['FR', 'EN'] as const
  type Lang = (typeof langs)[number]

  const currentLang = (i18n.language.toUpperCase().slice(0, 2)) as Lang

  // User initials from profile
  const userInitials = profile
    ? `${(profile.prenom ?? '').charAt(0)}${(profile.nom ?? '').charAt(0)}`.toUpperCase() || '?'
    : '?'

  return (
    <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-white/90 backdrop-blur-md border-b border-outline-variant/15">
      {/* Brand */}
      <div className="flex items-center gap-3">
        {/* WOSM accent bar */}
        <div className="w-1 h-7 rounded-full bg-wosm-purple" aria-hidden="true" />
        <span className="text-xl font-bold tracking-tighter text-wosm-purple font-headline">
          GSAT Digital
        </span>
        <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full bg-wosm-yellow-container text-wosm-on-yellow-container text-[10px] font-bold tracking-wide">
          V3.0
        </span>
      </div>

      {/* Language switcher — pill style */}
      <nav className="hidden md:flex items-center" aria-label="Language">
        <div className="flex items-center bg-wosm-purple-container/60 rounded-full p-0.5">
          {langs.map((lang) => (
            <button
              key={lang}
              onClick={() => i18n.changeLanguage(lang.toLowerCase())}
              className={[
                'px-3.5 py-1 text-xs font-bold tracking-tight rounded-full transition-all duration-200',
                currentLang === lang
                  ? 'bg-wosm-purple text-white shadow-sm'
                  : 'text-outline hover:text-wosm-purple',
              ].join(' ')}
              aria-current={currentLang === lang ? 'true' : undefined}
              aria-label={lang === 'FR' ? 'Passer en francais' : 'Switch to English'}
            >
              {lang}
            </button>
          ))}
        </div>
      </nav>

      {/* Right actions */}
      <div className="flex items-center space-x-1">
        {/* Globe — mobile language toggle */}
        <button
          className="p-2 hover:bg-wosm-purple-container/50 rounded-full transition-colors md:hidden"
          onClick={() => i18n.changeLanguage(i18n.language === 'fr' ? 'en' : 'fr')}
          aria-label={i18n.language === 'fr' ? 'Switch to English' : 'Passer en Francais'}
        >
          <span className="material-symbols-outlined text-on-surface-variant text-[20px]">language</span>
        </button>

        {/* Notifications */}
        <button className="p-2 hover:bg-[#EDE7F6]/50 rounded-full transition-colors relative" aria-label="Notifications">
          <span className="material-symbols-outlined text-on-surface-variant text-[20px]">notifications</span>
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-wosm-purple text-white text-[10px] font-bold leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Settings */}
        <button className="p-2 hover:bg-[#EDE7F6]/50 rounded-full transition-colors" aria-label="Settings">
          <span className="material-symbols-outlined text-on-surface-variant text-[20px]">settings</span>
        </button>

        {/* Avatar with initials */}
        <button
          className="w-9 h-9 rounded-full flex items-center justify-center ml-1.5 font-headline font-bold text-xs transition-all duration-200 hover:ring-2 hover:ring-wosm-purple-muted focus-visible:ring-2 focus-visible:ring-wosm-purple"
          style={{
            background: 'linear-gradient(135deg, #4B2E83 0%, #6B4FA3 100%)',
            color: '#FDB714',
          }}
          aria-label="Account menu"
        >
          {userInitials}
        </button>
      </div>
    </header>
  )
}
