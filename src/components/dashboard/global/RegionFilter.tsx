import { useTranslation } from 'react-i18next'
import { colors, borderRadius } from '@/design/tokens'
import type { RegionCode } from '@/types'

// ── Types ────────────────────────────────────────────────────────────────────

interface RegionFilterProps {
  selectedRegion: RegionCode | null
  onSelect: (region: RegionCode | null) => void
}

// ── Constants ────────────────────────────────────────────────────────────────

const REGIONS: Array<{ code: RegionCode | null; labelKey: string; colorDot: string }> = [
  { code: null,            labelKey: 'cartographie.regions.toutes',       colorDot: colors.primary },
  { code: 'AFRICA',        labelKey: 'cartographie.regions.africa',       colorDot: '#F59E0B' },
  { code: 'ARAB',          labelKey: 'cartographie.regions.arab',         colorDot: `${colors.error}cc` },
  { code: 'ASIA_PACIFIC',  labelKey: 'cartographie.regions.asia_pacific', colorDot: colors.primary },
  { code: 'EURASIA',       labelKey: 'cartographie.regions.eurasia',      colorDot: '#7C3AED' },
  { code: 'EUROPE',        labelKey: 'cartographie.regions.europe',       colorDot: '#6366F1' },
  { code: 'INTERAMERICA',  labelKey: 'cartographie.regions.interamerica', colorDot: colors.secondary },
]

// ── Component ────────────────────────────────────────────────────────────────

export function RegionFilter({ selectedRegion, onSelect }: RegionFilterProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-wrap gap-2">
      {REGIONS.map(region => {
        const isActive = selectedRegion === region.code

        return (
          <button
            key={region.code ?? 'all'}
            onClick={() => onSelect(region.code)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all"
            style={{
              background: isActive ? colors.surfaceContainerLowest : colors.surfaceContainerLow,
              color: isActive ? colors.primary : colors.onSurfaceVariant,
              boxShadow: isActive ? `0 2px 4px ${colors.primary}15` : 'none',
              borderRadius: borderRadius.lg,
            }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: region.colorDot }}
            />
            {t(region.labelKey)}
          </button>
        )
      })}
    </div>
  )
}
