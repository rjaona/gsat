import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { colors, scoreTextColor } from '@/design/tokens'
import type { CountryScore } from '@/stores/dashboardGlobalStore'

// ── Types ────────────────────────────────────────────────────────────────────

interface CountryComparisonTableProps {
  countries: CountryScore[]
  dimensionCodes: string[]
}

type SortField = 'nom' | 'scoreGlobal' | string
type SortDir = 'asc' | 'desc'

// ── Component ────────────────────────────────────────────────────────────────

export function CountryComparisonTable({
  countries,
  dimensionCodes,
}: CountryComparisonTableProps) {
  const { t } = useTranslation()
  const [sortField, setSortField] = useState<SortField>('scoreGlobal')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const sorted = useMemo(() => {
    return [...countries].sort((a, b) => {
      let aVal: number | string
      let bVal: number | string

      if (sortField === 'nom') {
        aVal = a.nom.toLowerCase()
        bVal = b.nom.toLowerCase()
      } else if (sortField === 'scoreGlobal') {
        aVal = a.scoreGlobal
        bVal = b.scoreGlobal
      } else {
        aVal = a.scoreParDimension[sortField] ?? 0
        bVal = b.scoreParDimension[sortField] ?? 0
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [countries, sortField, sortDir])

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  function renderSortIcon(field: SortField) {
    if (sortField !== field) return null
    return (
      <span className="material-symbols-outlined text-[14px] ml-0.5">
        {sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
      </span>
    )
  }

  return (
    <div
      className="card overflow-hidden"
      style={{ background: colors.surfaceContainerLowest }}
    >
      {/* Header */}
      <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3
            className="font-headline font-bold text-lg"
            style={{ color: colors.primary }}
          >
            {t('dashboardGlobal.comparison')}
          </h3>
          <p className="text-sm" style={{ color: colors.onSurfaceVariant }}>
            {t('dashboardGlobal.comparisonSubtitle')}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr style={{ background: colors.surfaceContainerHigh }}>
              <th
                className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider cursor-pointer select-none"
                style={{ color: colors.onSurfaceVariant }}
                onClick={() => toggleSort('nom')}
              >
                {t('dashboardGlobal.country')} {renderSortIcon('nom')}
              </th>
              <th
                className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider cursor-pointer select-none"
                style={{ color: colors.onSurfaceVariant }}
                onClick={() => toggleSort('scoreGlobal')}
              >
                {t('dashboardGlobal.maturity')} {renderSortIcon('scoreGlobal')}
              </th>
              {dimensionCodes.slice(0, 5).map(code => (
                <th
                  key={code}
                  className="px-4 py-4 text-[10px] font-bold uppercase tracking-wider cursor-pointer select-none hidden lg:table-cell"
                  style={{ color: colors.onSurfaceVariant }}
                  onClick={() => toggleSort(code)}
                >
                  {code} {renderSortIcon(code)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: colors.surfaceContainerLow }}>
            {sorted.map((country, idx) => (
              <tr
                key={country.orgId}
                className="transition-colors hover:bg-surface-container-low/30"
                style={{
                  background: idx % 2 === 1 ? `${colors.surfaceContainerLow}40` : undefined,
                }}
              >
                <td className="px-6 py-4">
                  <span className="font-bold" style={{ color: colors.onSurface }}>
                    {country.nom}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span
                    className="font-headline font-bold"
                    style={{ color: scoreTextColor(country.scoreGlobal) }}
                  >
                    {country.scoreGlobal > 0 ? `${country.scoreGlobal}%` : '-'}
                  </span>
                </td>
                {dimensionCodes.slice(0, 5).map(code => {
                  const dimScore = country.scoreParDimension[code] ?? 0
                  return (
                    <td key={code} className="px-4 py-4 hidden lg:table-cell">
                      <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: colors.surfaceContainerHighest }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(dimScore, 100)}%`,
                            background: scoreTextColor(dimScore),
                          }}
                        />
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {countries.length === 0 && (
        <div className="p-8 text-center text-sm" style={{ color: colors.onSurfaceVariant }}>
          {t('dashboard.aucuneDonnee')}
        </div>
      )}
    </div>
  )
}
