/**
 * ComparaisonAsnPage — Comparaison détaillée entre deux ASN
 * Source Stitch : comparaison_d_taill_e_entre_deux_asn/code.html
 * Side-by-side bento, dimension breakdown, radar Recharts
 */
import { useState } from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  Legend,
} from 'recharts';

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

interface AsnData {
  name: string;
  country: string;
  region: string;
  score: number;
  dimensions: { label: string; pct: number }[];
}

const ASN_A: AsnData = {
  name: 'Association Scouts de France',
  country: 'France',
  region: 'Europe',
  score: 88,
  dimensions: [
    { label: 'Gouvernance', pct: 92 },
    { label: 'Ressources Humaines', pct: 85 },
    { label: 'Finances', pct: 90 },
    { label: 'Programme Jeunesse', pct: 88 },
    { label: 'Communication', pct: 80 },
    { label: 'Infrastructure', pct: 87 },
  ],
};

const ASN_B: AsnData = {
  name: 'Kenya Scouts Association',
  country: 'Kenya',
  region: 'Afrique',
  score: 74,
  dimensions: [
    { label: 'Gouvernance', pct: 78 },
    { label: 'Ressources Humaines', pct: 65 },
    { label: 'Finances', pct: 72 },
    { label: 'Programme Jeunesse', pct: 80 },
    { label: 'Communication', pct: 70 },
    { label: 'Infrastructure', pct: 75 },
  ],
};

function AsnCard({ data, accent }: { data: AsnData; accent: string }) {
  return (
    <div
      className="flex-1 p-8 space-y-6"
      style={{
        background: 'var(--surface-container-lowest)',
        boxShadow: 'var(--shadow-card)',
        borderRadius: 'var(--radius-xl)',
        borderTop: `4px solid ${accent}`,
      }}
    >
      {/* Header */}
      <div>
        <span className="label-caps block mb-1" style={{ color: accent }}>{data.region}</span>
        <h3
          className="text-xl font-extrabold tracking-tight"
          style={{ color: accent, fontFamily: 'var(--font-headline)' }}
        >
          {data.name}
        </h3>
        <p className="text-sm mt-1" style={{ color: 'var(--on-surface-variant)' }}>{data.country}</p>
      </div>

      {/* Big score */}
      <div
        className="p-6 text-center"
        style={{ background: 'var(--surface-container-low)', borderRadius: 'var(--radius-xl)' }}
      >
        <p className="label-caps mb-1">Score Global GSAT</p>
        <p
          className="text-6xl font-extrabold tracking-tighter leading-none"
          style={{ color: accent, fontFamily: 'var(--font-headline)' }}
        >
          {data.score}%
        </p>
      </div>

      {/* Dimensions */}
      <div className="space-y-4">
        <h4 className="text-sm font-bold" style={{ color: 'var(--on-surface)', fontFamily: 'var(--font-headline)' }}>
          Performance par dimension
        </h4>
        {data.dimensions.map(d => (
          <div key={d.label} className="space-y-1.5">
            <div className="flex justify-between items-end">
              <span className="label-caps" style={{ color: 'var(--on-surface-variant)' }}>{d.label}</span>
              <span className="text-sm font-bold" style={{ color: accent }}>{d.pct}%</span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden"
              style={{ background: 'var(--surface-container-highest)', borderRadius: 'var(--radius-full)' }}
            >
              <div
                style={{
                  width: `${d.pct}%`,
                  height: '100%',
                  background: accent,
                  borderRadius: 'var(--radius-full)',
                  opacity: 0.8,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ComparaisonAsnPage() {
  const [asnA] = useState(ASN_A);
  const [asnB] = useState(ASN_B);

  return (
    <div className="p-8 space-y-8 max-w-[1400px] mx-auto w-full">

      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="label-caps block mb-2">Analyse comparative</span>
          <h2
            className="text-4xl font-extrabold tracking-tight"
            style={{ color: 'var(--primary)', fontFamily: 'var(--font-headline)' }}
          >
            Comparaison Détaillée ASN
          </h2>
          <p className="text-sm mt-2" style={{ color: 'var(--on-surface-variant)' }}>
            Analyse côte à côte des performances GSAT entre deux organisations nationales.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            className="px-4 py-2 flex items-center gap-2 text-sm font-semibold transition-colors"
            style={{
              background: 'var(--surface-container-high)',
              color: 'var(--on-surface)',
              borderRadius: 'var(--radius-xl)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Icon name="tune" size={16} />
            Sélectionner ASN
          </button>
          <button
            className="px-4 py-2 flex items-center gap-2 text-sm font-bold transition-colors"
            style={{
              background: 'var(--gradient-primary)',
              color: 'white',
              borderRadius: 'var(--radius-xl)',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(21,35,110,0.25)',
            }}
          >
            <Icon name="download" size={16} />
            Exporter
          </button>
        </div>
      </div>

      {/* Delta summary bar */}
      <div
        className="p-5 flex items-center justify-between"
        style={{
          background: 'var(--surface-container-lowest)',
          boxShadow: 'var(--shadow-card)',
          borderRadius: 'var(--radius-xl)',
        }}
      >
        <div className="text-center flex-1">
          <p className="label-caps mb-1" style={{ color: 'var(--primary)' }}>{asnA.name}</p>
          <p
            className="text-3xl font-extrabold"
            style={{ color: 'var(--primary)', fontFamily: 'var(--font-headline)' }}
          >
            {asnA.score}%
          </p>
        </div>
        <div className="flex flex-col items-center px-8">
          <span className="label-caps mb-1">Écart</span>
          <span
            className="text-2xl font-extrabold"
            style={{ color: 'var(--secondary)', fontFamily: 'var(--font-headline)' }}
          >
            +{asnA.score - asnB.score}pts
          </span>
          <Icon name="compare_arrows" size={24} />
        </div>
        <div className="text-center flex-1">
          <p className="label-caps mb-1" style={{ color: 'var(--secondary)' }}>{asnB.name}</p>
          <p
            className="text-3xl font-extrabold"
            style={{ color: 'var(--secondary)', fontFamily: 'var(--font-headline)' }}
          >
            {asnB.score}%
          </p>
        </div>
      </div>

      {/* Side-by-side cards */}
      <div className="flex gap-6">
        <AsnCard data={asnA} accent="var(--primary)" />
        <AsnCard data={asnB} accent="var(--secondary)" />
      </div>

      {/* Radar Recharts — comparaison multidimensionnelle */}
      <div
        className="p-8"
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
          Graphique Radar — Comparaison multidimensionnelle
        </h3>
        <ResponsiveContainer width="100%" height={320}>
          <RadarChart
            cx="50%"
            cy="50%"
            outerRadius="70%"
            data={asnA.dimensions.map((d, i) => ({
              dimension: d.label,
              [asnA.name]: d.pct,
              [asnB.name]: asnB.dimensions[i]?.pct ?? 0,
              fullMark: 100,
            }))}
            margin={{ top: 10, right: 40, bottom: 10, left: 40 }}
          >
            <PolarGrid stroke="var(--surface-container-highest)" strokeDasharray="3 3" />
            <PolarAngleAxis
              dataKey="dimension"
              tick={{ fontSize: 10, fill: 'var(--on-surface-variant)', fontFamily: 'Inter' }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fontSize: 8, fill: 'var(--outline)' }}
              tickCount={5}
            />
            <Radar
              name={asnA.name}
              dataKey={asnA.name}
              stroke="#15236e"
              fill="#dee0ff"
              fillOpacity={0.4}
              strokeWidth={2}
            />
            <Radar
              name={asnB.name}
              dataKey={asnB.name}
              stroke="#3b6934"
              fill="#b9eeab"
              fillOpacity={0.35}
              strokeWidth={2}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, fontFamily: 'Inter', paddingTop: 12 }}
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
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
