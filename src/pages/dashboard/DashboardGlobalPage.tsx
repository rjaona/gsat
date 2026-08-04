import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { colors, gradients } from '@/design/tokens'
import { useAuthStore } from '@/stores/authStore'
import { useDashboardGlobalStore } from '@/stores/dashboardGlobalStore'
import { WorldMap } from '@/components/dashboard/global/WorldMap'
import { RegionFilter } from '@/components/dashboard/global/RegionFilter'
import { RegionScoreCard } from '@/components/dashboard/global/RegionScoreCard'
import { CountryComparisonTable } from '@/components/dashboard/global/CountryComparisonTable'
import { GlobalRadarChart } from '@/components/dashboard/global/GlobalRadarChart'

// ── Constants ────────────────────────────────────────────────────────────────

const DIMENSION_CODES = ['D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10']

// ── Component ────────────────────────────────────────────────────────────────

export function DashboardGlobalPage() {
  const { t } = useTranslation()
  const { role } = useAuthStore()

  const {
    countryScores,
    regionSummaries,
    globalScore,
    selectedRegion,
    loading,
    error,
    loadGlobalData,
    setSelectedRegion,
    filteredCountries,
  } = useDashboardGlobalStore()

  // Load data — only for authorised roles to avoid unnecessary Supabase reads
  useEffect(() => {
    if (role === 'admin_global' || role === 'responsable_region') {
      void loadGlobalData()
    }
  }, [role, loadGlobalData])

  // Access check — admin_global only
  if (role !== 'admin_global') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <span className="material-symbols-outlined text-4xl mb-2" style={{ color: colors.outline }}>
            lock
          </span>
          <p className="text-sm" style={{ color: colors.onSurfaceVariant }}>
            {t('dashboardGlobal.accessDenied')}
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-sm" style={{ color: colors.onSurfaceVariant }}>
          {t('common.loading')}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-sm" style={{ color: colors.error }}>{error}</div>
      </div>
    )
  }

  const filtered = filteredCountries()

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto w-full">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span
            className="text-xs font-bold tracking-[0.1em] uppercase label-caps"
          >
            {t('dashboardGlobal.subtitle')}
          </span>
          <h2
            className="text-4xl font-headline font-extrabold tracking-tight mt-1"
            style={{ color: colors.primary }}
          >
            {t('dashboardGlobal.title')}
          </h2>
        </div>
        <RegionFilter
          selectedRegion={selectedRegion}
          onSelect={setSelectedRegion}
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Map (8 cols) */}
        <div
          className="lg:col-span-8 card overflow-hidden flex flex-col"
        >
          <div
            className="p-6 border-b flex items-center justify-between"
            style={{ borderColor: `${colors.outlineVariant}15` }}
          >
            <div>
              <h3 className="font-headline font-bold text-lg" style={{ color: colors.primary }}>
                {t('dashboardGlobal.mapTitle')}
              </h3>
              <p className="text-sm" style={{ color: colors.onSurfaceVariant }}>
                {t('dashboardGlobal.mapSubtitle')}
              </p>
            </div>
          </div>
          <div className="flex-1 min-h-[450px]">
            <WorldMap countryScores={filtered} />
          </div>
        </div>

        {/* Right column: Global score + Priority list (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Global score hero */}
          <div
            className="p-6 rounded-xl text-white relative overflow-hidden"
            style={{ background: gradients.primary }}
          >
            <div className="relative z-10">
              <h4 className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: colors.primaryFixedDim }}>
                {t('dashboardGlobal.globalScoreLabel')}
              </h4>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-headline font-extrabold">{globalScore}</span>
              </div>
              <div className="mt-6 h-1 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(globalScore, 100)}%`,
                    background: colors.secondary,
                  }}
                />
              </div>
            </div>
            {/* Decorative icon */}
            <span
              className="material-symbols-outlined absolute -bottom-4 -right-4 text-[120px] opacity-10"
            >
              monitoring
            </span>
          </div>

          {/* Radar chart */}
          <GlobalRadarChart
            countries={filtered}
            dimensionCodes={DIMENSION_CODES}
          />
        </div>

        {/* Region score cards (full width) */}
        <div className="lg:col-span-12">
          <div
            className="p-8 rounded-xl"
            style={{ background: colors.surfaceContainer }}
          >
            <h3
              className="text-2xl font-bold font-headline mb-8"
              style={{ color: colors.primary }}
            >
              {t('dashboardGlobal.regionComparison')}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
              {regionSummaries.map(region => (
                <RegionScoreCard
                  key={region.code}
                  code={region.code}
                  label={region.label}
                  avgScore={region.avgScore}
                  osnCount={region.osnCount}
                  osnEvaluated={region.osnEvaluated}
                  growth={region.growth}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Comparison table (full width) */}
        <div className="lg:col-span-12">
          <CountryComparisonTable
            countries={filtered}
            dimensionCodes={DIMENSION_CODES}
          />
        </div>
      </div>
    </div>
  )
}
