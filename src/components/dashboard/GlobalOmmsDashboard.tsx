/**
 * GlobalOmmsDashboard — Tableau de bord global OMMS
 * Source Stitch : tableau_de_bord_global_omms/code.html
 * Bento grid layout, asymmetric 12-col, carte Leaflet, KPI cards
 */
import { useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip as MapTooltip } from 'react-leaflet';
import { StatCard } from '@/components/ui';
import 'leaflet/dist/leaflet.css';

// ── Stitch icon helper ──────────────────────────────────────────────────────
function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <span
      className="material-symbols-outlined"
      style={{ fontSize: size, lineHeight: 1 }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

// ── Region avatar pill ──────────────────────────────────────────────────────
function RegionAvatar({ code, bg }: { code: string; bg: string }) {
  return (
    <div
      className="w-8 h-8 flex items-center justify-center text-xs font-bold text-white border-2 border-white"
      style={{ background: bg, borderRadius: '50%' }}
    >
      {code}
    </div>
  );
}

// ── Dimension progress row ──────────────────────────────────────────────────
function DimensionRow({ label, pct, color = 'var(--secondary)' }: { label: string; pct: number; color?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-end">
        <span className="label-caps" style={{ color: 'var(--on-surface-variant)' }}>{label}</span>
        <span className="text-sm font-bold" style={{ color: 'var(--primary)' }}>{pct}%</span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden"
        style={{ background: 'var(--surface-container-highest)', borderRadius: 'var(--radius-full)' }}
      >
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 'var(--radius-full)' }} />
      </div>
    </div>
  );
}

// ── OSN performance card ────────────────────────────────────────────────────
interface OsnRow {
  name: string;
  region: string;
  score: number;
  trend: 'up' | 'down' | 'flat';
  status: 'excellent' | 'moyen' | 'faible' | 'critique';
}

const STATUS_COLORS: Record<OsnRow['status'], { bg: string; text: string; label: string }> = {
  excellent: { bg: 'var(--secondary-container)', text: 'var(--secondary)',   label: 'Excellent' },
  moyen:     { bg: 'var(--warning-light)',        text: 'var(--warning-dark)', label: 'Moyen' },
  faible:    { bg: 'rgba(249,115,22,0.12)',       text: '#c2410c',            label: 'Faible' },
  critique:  { bg: 'var(--error-container)',      text: 'var(--error)',       label: 'Critique' },
};

// Coordonnées approximatives pour les OSN de démonstration
const OSN_COORDS: Record<string, [number, number]> = {
  France:      [46.2, 2.2],
  Kenya:       [-1.3, 36.8],
  Brésil:      [-14.2, -51.9],
  Thaïlande:   [15.9, 100.9],
  Maroc:       [31.8, -7.1],
  Allemagne:   [51.2, 10.5],
};

function osnStatusColor(status: OsnRow['status']): string {
  switch (status) {
    case 'excellent': return '#3b6934';
    case 'moyen':     return '#F59E0B';
    case 'faible':    return '#F97316';
    case 'critique':  return '#ba1a1a';
  }
}

const SAMPLE_OSN: OsnRow[] = [
  { name: 'France', region: 'Europe', score: 88, trend: 'up', status: 'excellent' },
  { name: 'Kenya', region: 'Afrique', score: 74, trend: 'up', status: 'moyen' },
  { name: 'Brésil', region: 'Amériques', score: 61, trend: 'flat', status: 'faible' },
  { name: 'Thaïlande', region: 'Asie-Pacifique', score: 79, trend: 'up', status: 'moyen' },
  { name: 'Maroc', region: 'Afrique', score: 42, trend: 'down', status: 'critique' },
  { name: 'Allemagne', region: 'Europe', score: 91, trend: 'up', status: 'excellent' },
];

// ── Main component ──────────────────────────────────────────────────────────

export function GlobalOmmsDashboard() {
  const [mapMode, setMapMode] = useState<'chaleur' | 'regions'>('chaleur');

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto w-full">

      {/* ── Page header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="label-caps block mb-2">Vision Stratégique 2024</span>
          <h2
            className="text-4xl font-extrabold tracking-tight"
            style={{ color: 'var(--primary)', fontFamily: 'var(--font-headline)' }}
          >
            Tableau de Bord Global OMMS
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            <RegionAvatar code="AF" bg="var(--secondary)" />
            <RegionAvatar code="EU" bg="var(--primary)" />
            <RegionAvatar code="AP" bg="var(--surface-tint)" />
          </div>
          <button
            className="px-4 py-2 flex items-center gap-2 text-sm font-semibold transition-colors"
            style={{
              background: 'var(--surface-container-high)',
              color: 'var(--on-surface)',
              borderRadius: 'var(--radius-xl)',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-container-highest)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-container-high)'}
          >
            <Icon name="filter_alt" size={18} />
            Filtres Régionaux
          </button>
        </div>
      </div>

      {/* ── KPI bar ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="OSN participantes" value="168" subLabel="sur 174 membres OMMS" trend={{ value: 4, label: 'vs 2023' }} />
        <StatCard label="Score global moyen" value="71.4%" trend={{ value: 3.2, label: 'vs 2023' }} variant="success" />
        <StatCard label="OSN en progression" value="112" subLabel="amélioration 12 mois" trend={{ value: 8 }} />
        <StatCard label="Plans d'action actifs" value="1,248" trend={{ value: 12 }} variant="primary" />
      </div>

      {/* ── Bento grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Main map card — 8 cols */}
        <div
          className="lg:col-span-8 flex flex-col overflow-hidden"
          style={{
            background: 'var(--surface-container-lowest)',
            boxShadow: 'var(--shadow-card)',
            borderRadius: 'var(--radius-xl)',
          }}
        >
          <div
            className="p-6 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(198,197,210,0.15)' }}
          >
            <div>
              <h3
                className="text-lg font-bold"
                style={{ color: 'var(--primary)', fontFamily: 'var(--font-headline)' }}
              >
                Maturité GSAT Mondiale
              </h3>
              <p className="text-sm" style={{ color: 'var(--on-surface-variant)' }}>
                Analyse de la conformité par organisation scoute nationale (OSN)
              </p>
            </div>
            {/* Toggle */}
            <div
              className="flex p-1"
              style={{ background: 'var(--surface-container-low)', borderRadius: 'var(--radius-xl)' }}
            >
              {(['chaleur', 'regions'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setMapMode(mode)}
                  className="px-3 py-1 text-xs font-bold transition-all"
                  style={{
                    background: mapMode === mode ? 'var(--surface-container-lowest)' : 'transparent',
                    color: mapMode === mode ? 'var(--primary)' : 'var(--outline)',
                    boxShadow: mapMode === mode ? 'var(--shadow-xs)' : 'none',
                    borderRadius: 'var(--radius-lg)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {mode.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          {/* Carte Leaflet — OSN par position */}
          <div className="flex-1 min-h-[320px]">
            <MapContainer
              center={[20, 0]}
              zoom={2}
              minZoom={1}
              maxZoom={6}
              zoomControl={false}
              attributionControl={false}
              style={{ height: '100%', minHeight: 320, width: '100%', background: '#e8ecf4' }}
              scrollWheelZoom={false}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://carto.com">CARTO</a>'
              />
              {SAMPLE_OSN.map(osn => {
                const coords = OSN_COORDS[osn.name];
                if (!coords) return null;
                return (
                  <CircleMarker
                    key={osn.name}
                    center={coords}
                    radius={14}
                    pathOptions={{
                      fillColor: osnStatusColor(osn.status),
                      color: '#ffffff',
                      weight: 2,
                      fillOpacity: 0.8,
                    }}
                  >
                    <MapTooltip>
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600 }}>
                        {osn.name} ({osn.region}) — {osn.score}%
                      </span>
                    </MapTooltip>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>
        </div>

        {/* Dimensions panel — 4 cols */}
        <div
          className="lg:col-span-4 flex flex-col p-6 gap-6"
          style={{
            background: 'var(--primary)',
            borderRadius: 'var(--radius-xl)',
          }}
        >
          <div>
            <h3
              className="text-xl font-bold text-white mb-6"
              style={{ fontFamily: 'var(--font-headline)' }}
            >
              Répartition par Dimension
            </h3>
            <div className="space-y-5">
              {[
                { label: 'Gouvernance', pct: 78 },
                { label: 'Ressources Humaines', pct: 62 },
                { label: 'Finances', pct: 84 },
                { label: 'Programme Jeunesse', pct: 71 },
                { label: 'Communication', pct: 55 },
              ].map(d => (
                <div key={d.label} className="space-y-1.5">
                  <div className="flex justify-between items-end">
                    <span className="text-xs font-semibold text-white/80">{d.label}</span>
                    <span className="text-sm font-bold text-white">{d.pct}%</span>
                  </div>
                  <div
                    className="h-2 w-full overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 'var(--radius-full)' }}
                  >
                    <div
                      style={{
                        width: `${d.pct}%`,
                        height: '100%',
                        background: 'var(--secondary-fixed-dim)',
                        borderRadius: 'var(--radius-full)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Generate report CTA */}
          <button
            className="w-full py-3 flex items-center justify-center gap-2 text-sm font-bold transition-all"
            style={{
              background: 'rgba(255,255,255,0.15)',
              color: 'white',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid rgba(255,255,255,0.2)',
              cursor: 'pointer',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.25)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.15)'}
          >
            <Icon name="description" size={18} />
            Générer un rapport
          </button>
        </div>

        {/* OSN Table — full width */}
        <div
          className="lg:col-span-12 overflow-hidden"
          style={{
            background: 'var(--surface-container-lowest)',
            boxShadow: 'var(--shadow-card)',
            borderRadius: 'var(--radius-xl)',
          }}
        >
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{ background: 'var(--surface-container-low)', borderBottom: '1px solid rgba(198,197,210,0.1)' }}
          >
            <h3
              className="text-base font-bold"
              style={{ color: 'var(--on-surface)', fontFamily: 'var(--font-headline)' }}
            >
              Performance par OSN
            </h3>
            <button
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold transition-colors"
              style={{
                background: 'var(--primary)',
                color: 'white',
                borderRadius: 'var(--radius-xl)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Icon name="file_download" size={16} />
              Export CSV
            </button>
          </div>
          <table className="min-w-full">
            <thead style={{ background: 'var(--surface-container-low)' }}>
              <tr>
                {['OSN', 'Région', 'Score Global', 'Tendance', 'Statut', 'Actions'].map(h => (
                  <th
                    key={h}
                    className="px-6 py-4 text-left label-caps"
                    style={{ borderBottom: '1px solid rgba(198,197,210,0.1)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SAMPLE_OSN.map((osn, i) => {
                const s = STATUS_COLORS[osn.status];
                return (
                  <tr
                    key={osn.name}
                    style={{
                      borderTop: i > 0 ? '1px solid rgba(198,197,210,0.08)' : undefined,
                      transition: 'background var(--transition)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-container-low)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold" style={{ color: 'var(--on-surface)' }}>{osn.name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm" style={{ color: 'var(--on-surface-variant)' }}>{osn.region}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span
                          className="text-sm font-bold"
                          style={{ color: 'var(--primary)', fontFamily: 'var(--font-headline)' }}
                        >
                          {osn.score}%
                        </span>
                        <div
                          className="flex-1 h-1.5 overflow-hidden"
                          style={{ background: 'var(--surface-container-highest)', borderRadius: 'var(--radius-full)', minWidth: 80 }}
                        >
                          <div style={{ width: `${osn.score}%`, height: '100%', background: 'var(--secondary)', borderRadius: 'var(--radius-full)' }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className="text-sm font-bold"
                        style={{
                          color: osn.trend === 'up' ? 'var(--secondary)' : osn.trend === 'down' ? 'var(--error)' : 'var(--outline)',
                        }}
                      >
                        {osn.trend === 'up' ? '↑' : osn.trend === 'down' ? '↓' : '→'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 text-xs font-bold"
                        style={{ background: s.bg, color: s.text, borderRadius: 'var(--radius-full)' }}
                      >
                        {s.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        className="text-xs font-semibold transition-colors"
                        style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        Voir détails →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
