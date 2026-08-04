/**
 * GlobalScoreSummary — Vue détaillée du score global
 * Source Stitch : global_score_summary_detailed_view/code.html
 * Hero card 100px score, bento 12-col, dimension breakdown, OSN table
 */
import { useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip as MapTooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

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

const DIMENSIONS = [
  { label: 'Gouvernance & Leadership', pct: 82, regions: 168 },
  { label: 'Ressources Humaines', pct: 67, regions: 168 },
  { label: 'Gestion Financière', pct: 74, regions: 168 },
  { label: 'Programme Jeunesse', pct: 79, regions: 168 },
  { label: 'Communication & Image', pct: 61, regions: 168 },
  { label: 'Infrastructure', pct: 71, regions: 168 },
];

// Régions avec coordonnées et couleurs pour la carte
const REGIONAL_MAP_DATA = [
  { region: 'Europe',         lat: 50,  lng: 10,   score: 84, osn: 46, color: '#15236e' },
  { region: 'Afrique',        lat: 0,   lng: 20,   score: 68, osn: 41, color: '#3b6934' },
  { region: 'Asie-Pacifique', lat: 15,  lng: 100,  score: 72, osn: 36, color: '#4c58a4' },
  { region: 'Amériques',      lat: 5,   lng: -75,  score: 79, osn: 28, color: '#7c3aed' },
];

function regionScoreToFill(score: number): string {
  if (score >= 80) return '#3b6934';
  if (score >= 70) return '#15236e';
  if (score >= 60) return '#F59E0B';
  return '#ba1a1a';
}

const TOP_OSN = [
  { name: 'Scouts UK', score: 94, delta: 2.1, region: 'Europe' },
  { name: 'Scouts Canada', score: 91, delta: 1.8, region: 'Amériques' },
  { name: 'Scouts Australie', score: 89, delta: 3.2, region: 'Asie-Pacifique' },
  { name: 'Scouts France', score: 88, delta: 0.5, region: 'Europe' },
  { name: 'Scouts Allemagne', score: 87, delta: 1.1, region: 'Europe' },
];

export function GlobalScoreSummary() {
  const [activeTab, setActiveTab] = useState<'dimensions' | 'regions' | 'osn'>('dimensions');

  return (
    <div className="p-8 space-y-8 max-w-[1400px] mx-auto w-full">

      {/* Breadcrumb + header */}
      <div className="flex justify-between items-end">
        <div>
          <nav
            className="flex gap-2 text-xs font-medium mb-2 uppercase tracking-widest"
            style={{ color: 'rgba(71,70,97,0.6)' }}
            aria-label="Fil d'Ariane"
          >
            <span>Résumé</span>
            <span>/</span>
            <span style={{ color: 'var(--primary)' }}>Niveau Global</span>
          </nav>
          <h1
            className="text-4xl font-extrabold tracking-tight"
            style={{ color: 'var(--primary)', fontFamily: 'var(--font-headline)' }}
          >
            Global Score Summary
          </h1>
        </div>
        <button
          className="flex items-center gap-2 px-6 py-3 text-sm font-semibold transition-all"
          style={{
            background: 'var(--gradient-primary)',
            color: 'white',
            borderRadius: 'var(--radius-lg)',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(21,35,110,0.25)',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.9'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
        >
          <Icon name="download" size={18} />
          Export Summary
        </button>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-12 gap-6">

        {/* Hero score card — 5 cols */}
        <div
          className="col-span-12 lg:col-span-5 flex flex-col justify-between p-10 relative overflow-hidden"
          style={{
            background: 'var(--surface-container)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid rgba(198,197,210,0.1)',
          }}
        >
          <div className="relative z-10">
            <h3
              className="text-sm font-bold uppercase tracking-widest mb-8"
              style={{ color: 'var(--on-surface-variant)' }}
            >
              Overall GSAT Achievement
            </h3>
            <div className="flex items-baseline gap-3">
              <span
                className="font-extrabold leading-none tracking-tighter"
                style={{
                  fontSize: '100px',
                  color: 'var(--primary)',
                  fontFamily: 'var(--font-headline)',
                }}
              >
                78.4%
              </span>
              <div
                className="flex items-center gap-1 font-bold text-lg mb-4"
                style={{ color: 'var(--secondary)' }}
              >
                <Icon name="arrow_upward" size={20} />
                3.2%
              </div>
            </div>
            <p className="text-sm" style={{ color: 'rgba(71,70,97,0.8)' }}>
              vs. Fiscal Year 2023 performance baseline
            </p>
          </div>
          <div className="mt-12 flex gap-4">
            <div className="text-center">
              <p
                className="text-3xl font-extrabold"
                style={{ color: 'var(--primary)', fontFamily: 'var(--font-headline)' }}
              >
                168
              </p>
              <p className="label-caps mt-1">OSN évaluées</p>
            </div>
            <div
              className="w-px"
              style={{ background: 'var(--outline-variant)', opacity: 0.3 }}
            />
            <div className="text-center">
              <p
                className="text-3xl font-extrabold"
                style={{ color: 'var(--secondary)', fontFamily: 'var(--font-headline)' }}
              >
                112
              </p>
              <p className="label-caps mt-1">En progression</p>
            </div>
            <div
              className="w-px"
              style={{ background: 'var(--outline-variant)', opacity: 0.3 }}
            />
            <div className="text-center">
              <p
                className="text-3xl font-extrabold"
                style={{ color: 'var(--error)', fontFamily: 'var(--font-headline)' }}
              >
                23
              </p>
              <p className="label-caps mt-1">En baisse</p>
            </div>
          </div>
        </div>

        {/* Distribution — 7 cols */}
        <div
          className="col-span-12 lg:col-span-7 flex flex-col p-8"
          style={{
            background: 'var(--surface-container-lowest)',
            boxShadow: 'var(--shadow-card)',
            borderRadius: 'var(--radius-xl)',
          }}
        >
          {/* Tab bar */}
          <div className="flex gap-1 mb-6 p-1" style={{ background: 'var(--surface-container-low)', borderRadius: 'var(--radius-xl)', width: 'fit-content' }}>
            {[
              { id: 'dimensions', label: 'Dimensions' },
              { id: 'regions',    label: 'Régions' },
              { id: 'osn',        label: 'Top OSN' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className="px-4 py-1.5 text-xs font-bold transition-all"
                style={{
                  background: activeTab === tab.id ? 'var(--surface-container-lowest)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--primary)' : 'var(--on-surface-variant)',
                  boxShadow: activeTab === tab.id ? 'var(--shadow-xs)' : 'none',
                  borderRadius: 'var(--radius-lg)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'dimensions' && (
            <div className="space-y-5 flex-1">
              {DIMENSIONS.map(d => (
                <div key={d.label} className="space-y-1.5">
                  <div className="flex justify-between items-end">
                    <span className="label-caps" style={{ color: 'var(--on-surface-variant)' }}>{d.label}</span>
                    <span className="text-sm font-bold" style={{ color: 'var(--primary)' }}>{d.pct}%</span>
                  </div>
                  <div
                    className="h-1.5 w-full overflow-hidden"
                    style={{ background: 'var(--surface-container-highest)', borderRadius: 'var(--radius-full)' }}
                  >
                    <div
                      style={{
                        width: `${d.pct}%`,
                        height: '100%',
                        background: d.pct >= 80 ? 'var(--secondary)' : d.pct >= 60 ? 'var(--warning)' : 'var(--error)',
                        borderRadius: 'var(--radius-full)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'osn' && (
            <div className="flex-1 space-y-2">
              {TOP_OSN.map((osn, i) => (
                <div
                  key={osn.name}
                  className="flex items-center gap-4 p-3 transition-colors"
                  style={{ borderRadius: 'var(--radius-xl)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-container-low)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <span
                    className="text-lg font-black w-6 text-center"
                    style={{ color: 'var(--outline)', fontFamily: 'var(--font-headline)' }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: 'var(--on-surface)' }}>{osn.name}</p>
                    <p className="text-xs" style={{ color: 'var(--on-surface-variant)' }}>{osn.region}</p>
                  </div>
                  <span
                    className="text-xl font-extrabold"
                    style={{ color: 'var(--primary)', fontFamily: 'var(--font-headline)' }}
                  >
                    {osn.score}%
                  </span>
                  <span
                    className="text-xs font-bold"
                    style={{ color: 'var(--secondary)' }}
                  >
                    +{osn.delta}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'regions' && (
            <div className="flex-1" style={{ minHeight: 260, borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
              <MapContainer
                center={[20, 10]}
                zoom={1}
                minZoom={1}
                maxZoom={5}
                zoomControl={false}
                attributionControl={false}
                style={{ height: 260, width: '100%', background: '#e8ecf4' }}
                scrollWheelZoom={false}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
                  attribution='&copy; <a href="https://carto.com">CARTO</a>'
                />
                {REGIONAL_MAP_DATA.map(r => (
                  <CircleMarker
                    key={r.region}
                    center={[r.lat, r.lng]}
                    radius={Math.max(16, r.osn / 2)}
                    pathOptions={{
                      fillColor: regionScoreToFill(r.score),
                      color: '#ffffff',
                      weight: 2,
                      fillOpacity: 0.78,
                    }}
                  >
                    <MapTooltip>
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600 }}>
                        {r.region} — {r.score}% · {r.osn} OSN
                      </span>
                    </MapTooltip>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          )}
        </div>

        {/* Regional breakdown — 4 cards */}
        {[
          { region: 'Europe',        score: 84, osn: 46, color: 'var(--primary)' },
          { region: 'Afrique',       score: 68, osn: 41, color: 'var(--secondary)' },
          { region: 'Asie-Pacifique', score: 72, osn: 36, color: 'var(--surface-tint)' },
          { region: 'Amériques',     score: 79, osn: 28, color: '#7c3aed' },
        ].map(r => (
          <div
            key={r.region}
            className="col-span-12 sm:col-span-6 lg:col-span-3 p-6"
            style={{
              background: 'var(--surface-container-lowest)',
              boxShadow: 'var(--shadow-card)',
              borderRadius: 'var(--radius-xl)',
              borderBottom: `4px solid ${r.color}`,
            }}
          >
            <p className="label-caps mb-2">{r.region}</p>
            <p
              className="text-4xl font-extrabold tracking-tight"
              style={{ color: r.color, fontFamily: 'var(--font-headline)' }}
            >
              {r.score}%
            </p>
            <p className="text-xs mt-2" style={{ color: 'var(--on-surface-variant)' }}>
              {r.osn} OSN participantes
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
