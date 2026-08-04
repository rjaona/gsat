/**
 * TendancesGlobales — Analyse des tendances globales OMMS
 * Source Stitch : analyse_des_tendances_globales_omms/code.html
 * Carte mondiale + répartition par dimension + KPIs + mini tendances
 */
import { useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip as MapTooltip } from 'react-leaflet';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import 'leaflet/dist/leaflet.css';

const DIMENSION_TRENDS = [
  { label: 'Gouvernance', pct: 78, delta: 3.1 },
  { label: 'Ressources Humaines', pct: 62, delta: -1.2 },
  { label: 'Finances', pct: 84, delta: 5.0 },
  { label: 'Programme Jeunesse', pct: 71, delta: 2.4 },
  { label: 'Communication', pct: 55, delta: 0.8 },
  { label: 'Infrastructure', pct: 67, delta: -0.5 },
];

const REGIONAL_KPI = [
  { region: 'Europe',        score: 84, osn: 46, trend: 2.1 },
  { region: 'Afrique',       score: 68, osn: 41, trend: 4.3 },
  { region: 'Asie-Pacifique', score: 72, osn: 36, trend: 1.8 },
  { region: 'Amériques',     score: 79, osn: 28, trend: 3.2 },
  { region: 'Arabe',         score: 61, osn: 17, trend: -0.4 },
];

// Coordonnées centrales approximatives par région OMMS
const REGION_COORDS: { region: string; lat: number; lng: number; score: number; osn: number }[] = [
  { region: 'Europe',         lat: 50,   lng: 10,   score: 84, osn: 46 },
  { region: 'Afrique',        lat: 0,    lng: 20,   score: 68, osn: 41 },
  { region: 'Asie-Pacifique', lat: 15,   lng: 100,  score: 72, osn: 36 },
  { region: 'Amériques',      lat: 5,    lng: -75,  score: 79, osn: 28 },
  { region: 'Arabe',          lat: 25,   lng: 45,   score: 61, osn: 17 },
];

function scoreToColor(score: number): string {
  if (score >= 80) return '#3b6934'; // excellent
  if (score >= 70) return '#15236e'; // moyen-haut
  if (score >= 60) return '#F59E0B'; // moyen
  return '#ba1a1a';                   // critique
}

// Données de tendance selon la période
const TREND_DATA: Record<'1y' | '3y' | '5y', { label: string; Europe: number; Afrique: number; Asie: number; Amériques: number; Arabe: number }[]> = {
  '1y': [
    { label: 'Jan', Europe: 81, Afrique: 64, Asie: 70, Amériques: 76, Arabe: 60 },
    { label: 'Mar', Europe: 82, Afrique: 65, Asie: 70, Amériques: 77, Arabe: 61 },
    { label: 'Mai', Europe: 82, Afrique: 66, Asie: 71, Amériques: 78, Arabe: 61 },
    { label: 'Jul', Europe: 83, Afrique: 67, Asie: 71, Amériques: 78, Arabe: 61 },
    { label: 'Sep', Europe: 83, Afrique: 67, Asie: 72, Amériques: 79, Arabe: 61 },
    { label: 'Nov', Europe: 84, Afrique: 68, Asie: 72, Amériques: 79, Arabe: 61 },
  ],
  '3y': [
    { label: '2022', Europe: 78, Afrique: 58, Asie: 67, Amériques: 72, Arabe: 58 },
    { label: '2023', Europe: 81, Afrique: 63, Asie: 70, Amériques: 76, Arabe: 60 },
    { label: '2024', Europe: 84, Afrique: 68, Asie: 72, Amériques: 79, Arabe: 61 },
  ],
  '5y': [
    { label: '2020', Europe: 72, Afrique: 52, Asie: 62, Amériques: 68, Arabe: 55 },
    { label: '2021', Europe: 75, Afrique: 55, Asie: 64, Amériques: 70, Arabe: 57 },
    { label: '2022', Europe: 78, Afrique: 58, Asie: 67, Amériques: 72, Arabe: 58 },
    { label: '2023', Europe: 81, Afrique: 63, Asie: 70, Amériques: 76, Arabe: 60 },
    { label: '2024', Europe: 84, Afrique: 68, Asie: 72, Amériques: 79, Arabe: 61 },
  ],
};

const LINE_COLORS = {
  Europe:     '#15236e',
  Afrique:    '#3b6934',
  Asie:       '#4c58a4',
  Amériques:  '#7c3aed',
  Arabe:      '#F59E0B',
};

export function TendancesGlobales() {
  const [period, setPeriod] = useState<'1y' | '3y' | '5y'>('1y');

  return (
    <div className="p-8 space-y-8 max-w-[1400px] mx-auto w-full">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="label-caps block mb-2">Analyse mondiale</span>
          <h1
            className="text-4xl font-extrabold tracking-tight"
            style={{ color: 'var(--primary)', fontFamily: 'var(--font-headline)' }}
          >
            Tendances Globales OMMS
          </h1>
          <p className="text-lg mt-2" style={{ color: 'var(--on-surface-variant)' }}>
            Indicateurs de performance GSAT et croissance stratégique mondiale.
          </p>
        </div>
        {/* Period selector */}
        <div
          className="flex p-1"
          style={{ background: 'var(--surface-container)', borderRadius: 'var(--radius-xl)' }}
        >
          {(['1y', '3y', '5y'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="px-4 py-1.5 text-xs font-bold transition-all"
              style={{
                background: period === p ? 'var(--surface-container-lowest)' : 'transparent',
                color: period === p ? 'var(--primary)' : 'var(--on-surface-variant)',
                boxShadow: period === p ? 'var(--shadow-xs)' : 'none',
                borderRadius: 'var(--radius-lg)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {p === '1y' ? '1 an' : p === '3y' ? '3 ans' : '5 ans'}
            </button>
          ))}
        </div>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-12 gap-6">

        {/* Map — 8 cols */}
        <section
          className="col-span-12 lg:col-span-8 p-6 relative overflow-hidden"
          style={{
            background: 'var(--surface-container-lowest)',
            boxShadow: 'var(--shadow-card)',
            borderRadius: 'var(--radius-xl)',
            minHeight: 400,
          }}
        >
          <div className="flex justify-between items-center mb-6">
            <h3
              className="text-xl font-bold"
              style={{ color: 'var(--primary)', fontFamily: 'var(--font-headline)' }}
            >
              Performance GSAT par Région
            </h3>
            <div className="flex gap-2">
              {[
                { label: 'Élevé',    bg: 'var(--secondary-container)', text: 'var(--on-secondary-container)' },
                { label: 'Moyen',    bg: 'var(--surface-container)',    text: 'var(--on-surface-variant)' },
                { label: 'Critique', bg: 'var(--error-container)',       text: 'var(--on-error-container)' },
              ].map(l => (
                <span
                  key={l.label}
                  className="flex items-center gap-1 text-xs font-bold px-2 py-1"
                  style={{ background: l.bg, color: l.text, borderRadius: 'var(--radius-lg)' }}
                >
                  {l.label}
                </span>
              ))}
            </div>
          </div>
          {/* Carte Leaflet — régions OMMS */}
          <div
            style={{ height: 300, borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}
          >
            <MapContainer
              center={[20, 0]}
              zoom={2}
              minZoom={1}
              maxZoom={5}
              zoomControl={false}
              attributionControl={false}
              style={{ height: '100%', width: '100%', background: '#e8ecf4' }}
              scrollWheelZoom={false}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://carto.com">CARTO</a>'
              />
              {REGION_COORDS.map(r => (
                <CircleMarker
                  key={r.region}
                  center={[r.lat, r.lng]}
                  radius={Math.max(18, r.osn / 1.8)}
                  pathOptions={{
                    fillColor: scoreToColor(r.score),
                    color: '#ffffff',
                    weight: 2,
                    fillOpacity: 0.75,
                  }}
                >
                  <MapTooltip>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600 }}>
                      {r.region} — {r.score}% ({r.osn} OSN)
                    </span>
                  </MapTooltip>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        </section>

        {/* Dimension breakdown — 4 cols */}
        <section
          className="col-span-12 lg:col-span-4 p-6 flex flex-col justify-between"
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
              {DIMENSION_TRENDS.map(d => (
                <div key={d.label} className="space-y-1.5">
                  <div className="flex justify-between text-sm font-medium text-white/90">
                    <span>{d.label}</span>
                    <div className="flex items-center gap-1.5">
                      <span>{d.pct}%</span>
                      <span
                        className="text-xs font-bold"
                        style={{ color: d.delta >= 0 ? 'var(--secondary-fixed-dim)' : 'var(--error-container)' }}
                      >
                        {d.delta >= 0 ? '+' : ''}{d.delta}%
                      </span>
                    </div>
                  </div>
                  <div
                    className="w-full h-2 overflow-hidden"
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
          <button
            className="mt-6 w-full py-2.5 text-sm font-semibold transition-all"
            style={{
              background: 'rgba(255,255,255,0.15)',
              color: 'white',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid rgba(255,255,255,0.2)',
              cursor: 'pointer',
            }}
          >
            Générer un rapport
          </button>
        </section>

        {/* Regional KPI grid — full width */}
        {REGIONAL_KPI.map(r => (
          <div
            key={r.region}
            className="col-span-12 sm:col-span-6 lg:col-span-2 p-5"
            style={{
              background: 'var(--surface-container-lowest)',
              boxShadow: 'var(--shadow-card)',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <p className="label-caps mb-2">{r.region}</p>
            <p
              className="text-3xl font-extrabold tracking-tight"
              style={{ color: 'var(--primary)', fontFamily: 'var(--font-headline)' }}
            >
              {r.score}%
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className="text-xs font-bold"
                style={{ color: r.trend >= 0 ? 'var(--secondary)' : 'var(--error)' }}
              >
                {r.trend >= 0 ? '+' : ''}{r.trend}%
              </span>
              <span className="text-xs" style={{ color: 'var(--on-surface-variant)' }}>
                {r.osn} OSN
              </span>
            </div>
          </div>
        ))}

        {/* Trend chart placeholder — 7 cols */}
        <section
          className="col-span-12 lg:col-span-7 p-6"
          style={{
            background: 'var(--surface-container-lowest)',
            boxShadow: 'var(--shadow-card)',
            borderRadius: 'var(--radius-xl)',
          }}
        >
          <h3
            className="text-base font-bold mb-6"
            style={{ color: 'var(--on-surface)', fontFamily: 'var(--font-headline)' }}
          >
            Évolution du Score Global ({period === '1y' ? '12 mois' : period === '3y' ? '3 ans' : '5 ans'})
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart
              data={TREND_DATA[period]}
              margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-container-highest)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: 'var(--on-surface-variant)', fontFamily: 'Inter' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[50, 100]}
                tick={{ fontSize: 9, fill: 'var(--on-surface-variant)', fontFamily: 'Inter' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `${v}%`}
              />
              <ChartTooltip
                formatter={(value: number, name: string) => [`${value}%`, name]}
                contentStyle={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 12,
                  borderRadius: 8,
                  border: '1px solid var(--outline-variant)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  background: 'var(--surface-container-lowest)',
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 10, fontFamily: 'Inter', paddingTop: 8 }}
              />
              <Line type="monotone" dataKey="Europe"    stroke={LINE_COLORS.Europe}    strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Afrique"   stroke={LINE_COLORS.Afrique}   strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Asie"      stroke={LINE_COLORS.Asie}       strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Amériques" stroke={LINE_COLORS.Amériques} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Arabe"     stroke={LINE_COLORS.Arabe}     strokeWidth={2} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </section>

        {/* Top movers — 5 cols */}
        <section
          className="col-span-12 lg:col-span-5 p-6"
          style={{
            background: 'var(--surface-container-lowest)',
            boxShadow: 'var(--shadow-card)',
            borderRadius: 'var(--radius-xl)',
          }}
        >
          <h3
            className="text-base font-bold mb-4"
            style={{ color: 'var(--on-surface)', fontFamily: 'var(--font-headline)' }}
          >
            Plus Fortes Progressions
          </h3>
          <div className="space-y-3">
            {[
              { name: 'Nigeria', delta: 8.4, score: 71, flag: '🇳🇬' },
              { name: 'Inde', delta: 6.2, score: 76, flag: '🇮🇳' },
              { name: 'Mexique', delta: 5.1, score: 74, flag: '🇲🇽' },
              { name: 'Éthiopie', delta: 4.8, score: 58, flag: '🇪🇹' },
              { name: 'Vietnam', delta: 4.3, score: 67, flag: '🇻🇳' },
            ].map((m, i) => (
              <div
                key={m.name}
                className="flex items-center gap-3 p-3 transition-colors"
                style={{ borderRadius: 'var(--radius-xl)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-container-low)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <span
                  className="text-sm font-black w-5 text-center"
                  style={{ color: 'var(--outline)', fontFamily: 'var(--font-headline)' }}
                >
                  {i + 1}
                </span>
                <span className="text-lg">{m.flag}</span>
                <span className="flex-1 text-sm font-medium" style={{ color: 'var(--on-surface)' }}>{m.name}</span>
                <span className="text-sm font-bold" style={{ color: 'var(--primary)' }}>{m.score}%</span>
                <span
                  className="text-xs font-bold px-2 py-0.5"
                  style={{ color: 'var(--secondary)', background: 'var(--secondary-container)', borderRadius: 'var(--radius-full)' }}
                >
                  +{m.delta}%
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
