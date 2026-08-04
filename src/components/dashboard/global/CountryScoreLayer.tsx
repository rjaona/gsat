import { useMemo } from 'react'
import { GeoJSON } from 'react-leaflet'
import { colors } from '@/design/tokens'
import type { CountryScore } from '@/stores/dashboardGlobalStore'
import type { Feature, GeoJsonObject } from 'geojson'
import type { Layer, Path, PathOptions } from 'leaflet'

// ── Types ────────────────────────────────────────────────────────────────────

interface CountryScoreLayerProps {
  geojson: GeoJsonObject
  countryScores: CountryScore[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function findCountryScore(
  feature: Feature,
  countryScores: CountryScore[],
): CountryScore | undefined {
  // Try matching by ISO code (properties.ISO_A2 or properties.iso_a2)
  const props = feature.properties ?? {}
  const iso = (props['ISO_A2'] ?? props['iso_a2'] ?? props['ISO_A3'] ?? '') as string

  return countryScores.find(cs => {
    if (!cs.codeIso) return false
    return cs.codeIso.toUpperCase() === iso.toUpperCase()
      || cs.codeIso.toUpperCase() === (iso.substring(0, 2)).toUpperCase()
  })
}

function getCountryColor(score: CountryScore | undefined): string {
  if (!score || score.scoreGlobal === 0) return colors.surfaceContainerHighest
  if (score.scoreGlobal >= 75) return colors.secondary
  if (score.scoreGlobal >= 50) return `${colors.secondary}88`
  if (score.scoreGlobal >= 25) return '#e97c00'
  return colors.error
}

// ── Component ────────────────────────────────────────────────────────────────

export function CountryScoreLayer({ geojson, countryScores }: CountryScoreLayerProps) {

  const style = useMemo(() => {
    return (feature?: Feature): PathOptions => {
      if (!feature) return { fillColor: colors.surfaceContainerHighest, weight: 0.5, fillOpacity: 0.7 }
      const cs = findCountryScore(feature, countryScores)
      return {
        fillColor: getCountryColor(cs),
        weight: 0.5,
        color: colors.outlineVariant,
        fillOpacity: cs && cs.scoreGlobal > 0 ? 0.75 : 0.3,
      }
    }
  }, [countryScores])

  const onEachFeature = useMemo(() => {
    return (feature: Feature, layer: Layer) => {
      const cs = findCountryScore(feature, countryScores)
      if (cs) {
        // Highlight on hover
        layer.on({
          mouseover: (e) => {
            const target = e.target as Path
            target.setStyle({ weight: 2, fillOpacity: 0.9, color: colors.primary })
            target.bringToFront()
          },
          mouseout: (e) => {
            const target = e.target as Path
            target.setStyle(style(feature))
          },
        })
      }
    }
  }, [countryScores, style])

  return (
    <GeoJSON
      data={geojson}
      style={style}
      onEachFeature={onEachFeature}
    />
  )
}
