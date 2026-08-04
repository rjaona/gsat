import { useTranslation } from 'react-i18next'

interface AsnParticipationRingProps {
  evaluated: number
  total: number
}

const RADIUS = 28
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * Anneau SVG montrant le ratio ASN évaluées / total.
 * Design Stitch : cercle gris fond + cercle secondary foreground, texte centré.
 */
export function AsnParticipationRing({ evaluated, total }: AsnParticipationRingProps) {
  const { t } = useTranslation()

  const pct = total > 0 ? Math.round((evaluated / total) * 100) : 0
  // strokeDashoffset = circumference * (1 - ratio)
  const offset = CIRCUMFERENCE * (1 - evaluated / (total || 1))

  return (
    <div className="bg-[#ffffff] p-6 rounded-2xl shadow-sm border border-[#c6c5d2]/10">
      <p className="text-[#454651] text-xs font-bold uppercase tracking-widest mb-6">
        {t('pages.dashboardOsn.participations', 'Participations')}
      </p>

      <div className="flex justify-between items-end">
        <div>
          <p className="text-3xl font-headline font-extrabold text-[#15236e]">
            {evaluated}/{total}
          </p>
          <p className="text-[#454651] text-xs font-medium">
            {t('pages.dashboardOsn.asnEvaluees', 'ASNs Évaluées')}
          </p>
        </div>

        {/* SVG Ring */}
        <div className="w-16 h-16 relative flex-shrink-0">
          <svg
            className="w-full h-full"
            style={{ transform: 'rotate(-90deg)' }}
            viewBox="0 0 64 64"
            aria-label={`${pct}% des ASN évaluées`}
          >
            {/* Piste fond */}
            <circle
              cx="32"
              cy="32"
              r={RADIUS}
              fill="transparent"
              stroke="#dee3eb"
              strokeWidth="5"
            />
            {/* Progression */}
            <circle
              cx="32"
              cy="32"
              r={RADIUS}
              fill="transparent"
              stroke="#3b6934"
              strokeWidth="5"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          </svg>
          {/* Texte centré */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-bold text-[#3b6934]">{pct}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
