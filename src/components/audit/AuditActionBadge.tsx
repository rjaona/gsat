import { useTranslation } from 'react-i18next'
import type { AuditAction } from '@/types'

interface AuditActionBadgeProps {
  action: AuditAction
}

type BadgeConfig = {
  label: { fr: string; en: string }
  icon: string
  cls: string
}

const ACTION_CONFIG: Record<AuditAction, BadgeConfig> = {
  create: {
    label: { fr: 'Créé', en: 'Created' },
    icon: 'add_circle',
    cls: 'bg-[#b9eeab] text-[#23501e]',
  },
  update: {
    label: { fr: 'Modifié', en: 'Updated' },
    icon: 'edit_note',
    cls: 'bg-amber-100 text-amber-800',
  },
  delete: {
    label: { fr: 'Supprimé', en: 'Deleted' },
    icon: 'delete',
    cls: 'bg-[#ffdad6] text-[#93000a]',
  },
  login: {
    label: { fr: 'Connexion', en: 'Login' },
    icon: 'login',
    cls: 'bg-[#dee0ff] text-[#33408a]',
  },
  logout: {
    label: { fr: 'Déconnexion', en: 'Logout' },
    icon: 'logout',
    cls: 'bg-[#eaeef7] text-[#454651]',
  },
  submit: {
    label: { fr: 'Soumis', en: 'Submitted' },
    icon: 'upload_file',
    cls: 'bg-[#b9eeab] text-[#23501e]',
  },
  validate: {
    label: { fr: 'Validé', en: 'Validated' },
    icon: 'verified',
    cls: 'bg-[#dee0ff] text-[#000f5c]',
  },
  close: {
    label: { fr: 'Clôturé', en: 'Closed' },
    icon: 'lock',
    cls: 'bg-[#ffdad6] text-[#ba1a1a]',
  },
}

/**
 * Badge coloré par type d'action audit.
 * Design Stitch : rounded-full, icon + label, taille [11px].
 */
export function AuditActionBadge({ action }: AuditActionBadgeProps) {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const config = ACTION_CONFIG[action] ?? ACTION_CONFIG.update

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${config.cls}`}
    >
      <span className="material-symbols-outlined text-sm">{config.icon}</span>
      {config.label[lang]}
    </span>
  )
}
