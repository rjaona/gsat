import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, ZoomControl } from 'react-leaflet'
import { useTranslation } from 'react-i18next'
import { colors } from '@/design/tokens'
import { CountryScoreLayer } from './CountryScoreLayer'
import type { CountryScore } from '@/stores/dashboardGlobalStore'
import type { GeoJsonObject } from 'geojson'
import 'leaflet/dist/leaflet.css'

// ── Types ────────────────────────────────────────────────────────────────────

interface WorldMapProps {
  countryScores: CountryScore[]
}

// ── Component ────────────────────────────────────────────────────────────────

export function WorldMap({ countryScores }: WorldMapProps) {
  const { t } = useTranslation()
  const [geojson, setGeojson] = useState<GeoJsonObject | null>(null)
  const [loadError, setLoadError] = useState(false)
  const fetchedRef = useRef(false)

  // Lazy-load GeoJSON (not in bundle)
  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    fetch('/geojson/world-countries.geojson')
      .then(res => {
        if (!res.ok) throw new Error(`GeoJSON fetch failed: ${res.status}`)
        return res.json() as Promise<GeoJsonObject>
      })
      .then(data => setGeojson(data))
      .catch(err => {
        console.error('[WorldMap] Failed to load GeoJSON:', err)
        setLoadError(true)
      })
  }, [])

  return (
    <div className="relative w-full h-full min-h-[450px] rounded-xl overflow-hidden">
      {/* Loading state */}
      {!geojson && !loadError && (
        <div
          className="absolute inset-0 flex items-center justify-center z-10"
          style={{ background: colors.surfaceContainerLow }}
        >
          <div className="flex items-center gap-2 text-sm" style={{ color: colors.onSurfaceVariant }}>
            <span className="material-symbols-outlined animate-spin">progress_activity</span>
            {t('common.loading')}
          </div>
        </div>
      )}

      {/* Error state */}
      {loadError && (
        <div
          className="absolute inset-0 flex items-center justify-center z-10"
          style={{ background: colors.surfaceContainerLow }}
        >
          <div className="text-center">
            <span className="material-symbols-outlined text-4xl mb-2" style={{ color: colors.outline }}>
              map
            </span>
            <p className="text-sm" style={{ color: colors.onSurfaceVariant }}>
              {t('dashboardGlobal.mapLoadError')}
            </p>
          </div>
        </div>
      )}

      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        maxZoom={6}
        zoomControl={false}
        style={{ height: '100%', width: '100%', background: colors.surfaceContainerLow }}
        scrollWheelZoom={true}
        attributionControl={false}
      >
        <ZoomControl position="bottomright" />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com">CARTO</a>'
        />
        {geojson && (
          <CountryScoreLayer geojson={geojson} countryScores={countryScores} />
        )}
      </MapContainer>

      {/* Legend overlay */}
      <div
        className="absolute bottom-6 left-6 p-4 rounded-xl border z-[1000]"
        style={{
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(8px)',
          borderColor: `${colors.outlineVariant}30`,
        }}
      >
        <p
          className="text-[10px] font-bold uppercase mb-2"
          style={{ color: colors.onSurfaceVariant }}
        >
          {t('cartographie.legende.titre')}
        </p>
        <div className="space-y-1.5">
          {[
            { color: colors.secondary, label: t('cartographie.legende.excellent') },
            { color: `${colors.secondary}88`, label: t('cartographie.legende.moyen') },
            { color: '#e97c00', label: t('cartographie.legende.faible') },
            { color: colors.error, label: t('cartographie.legende.critique') },
            { color: colors.surfaceContainerHighest, label: t('cartographie.legende.sansDonnee') },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ background: color }} />
              <span className="text-xs font-medium" style={{ color: colors.onSurface }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
