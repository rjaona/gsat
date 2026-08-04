import { useTranslation } from 'react-i18next'
import type { CampagneStatut } from '@/types'

interface CampagneStatutBadgeProps {
  statut: CampagneStatut
}

const CONFIG: Record<CampagneStatut, { dot: string; text: string; label: string }> = {
  planifiee: { dot: 'bg-[#c6c5d2]', text: 'text-[#454651]', label: 'campagne.statuts.planifiee' },
  ouverte:   { dot: 'bg-[#15236e] animate-pulse', text: 'text-[#15236e]', label: 'campagne.statuts.ouverte' },
  fermee:    { dot: 'bg-[#adaeb3]', text: 'text-[#2a2c30]', label: 'campagne.statuts.fermee' },
  archivee:  { dot: 'bg-[#3b6934]', text: 'text-[#3b6934]', label: 'campagne.statuts.archivee' },
}

export function CampagneStatutBadge({ statut }: CampagneStatutBadgeProps) {
  const { t } = useTranslation()
  const cfg = CONFIG[statut]

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      <span className={`text-xs font-semibold ${cfg.text}`}>
        {t(cfg.label)}
      </span>
    </div>
  )
}
