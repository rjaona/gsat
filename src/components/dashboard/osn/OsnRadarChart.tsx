import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { useTranslation } from 'react-i18next'

interface OsnRadarChartProps {
  scoreParDimension: Record<string, number>
}

const DIMENSION_LABELS: Record<string, string> = {
  D01: 'Institutionnel',
  D02: 'Gouvernance',
  D03: 'Stratégie',
  D04: 'Intégrité',
  D05: 'Communication',
  D06: 'Adultes',
  D07: 'Finances',
  D08: 'Programme',
  D09: 'Croissance',
  D10: 'Amélioration',
}

/**
 * Radar Recharts — scores agrégés par dimension pour l'OSN.
 * Design Stitch : fond blanc, primary stroke, secondaryContainer fill.
 */
export function OsnRadarChart({ scoreParDimension }: OsnRadarChartProps) {
  const { t } = useTranslation()

  const data = Object.entries(scoreParDimension).map(([code, score]) => ({
    dimension: DIMENSION_LABELS[code] ?? code,
    score,
    fullMark: 100,
  }))

  if (data.length === 0) {
    return (
      <div className="bg-[#ffffff] rounded-2xl shadow-sm p-8 text-center border border-[#c6c5d2]/5">
        <span className="material-symbols-outlined text-[#c6c5d2] text-4xl">radar</span>
        <p className="text-[#454651] text-sm mt-3">
          {t('dashboard.aucuneDonnee', 'Aucune donnée disponible')}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-[#ffffff] rounded-2xl shadow-sm p-6 border border-[#c6c5d2]/5">
      <div className="flex justify-between items-center mb-6">
        <h4 className="font-headline font-bold text-[#15236e]">
          {t('dashboard.radarDimensions', 'Scores par dimension')}
        </h4>
        <span className="text-xs text-[#454651] italic">
          {t('pages.dashboardOsn.agregeNational', 'Agrégé — niveau national')}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid stroke="#dee3eb" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fontSize: 10, fill: '#454651', fontFamily: 'Inter' }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 9, fill: '#767682' }}
            tickCount={4}
          />
          <Radar
            name="Score"
            dataKey="score"
            stroke="#15236e"
            fill="#dee0ff"
            fillOpacity={0.5}
            strokeWidth={2}
          />
          <Tooltip
            formatter={(value: number) => [`${value}%`, 'Score']}
            contentStyle={{
              fontFamily: 'Inter',
              fontSize: 12,
              borderRadius: 8,
              border: '1px solid #c6c5d2',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
