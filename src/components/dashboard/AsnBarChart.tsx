import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  LabelList,
} from 'recharts';

interface AsnBarChartProps {
  scoresAsn: Record<string, number>; // { 'tem-antananarivo': 85, 'tem-fianarantsoa': 72, ... }
  height?: number;
}

function couleurScore(score: number): string {
  if (score >= 75) return 'var(--score-excellent)';
  if (score >= 50) return 'var(--score-moyen)';
  if (score >= 25) return 'var(--score-faible)';
  return 'var(--score-critique)';
}

function formatAsnName(id: string): string {
  return id
    .split('-')
    .slice(1)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function AsnBarChart({ scoresAsn, height = 220 }: AsnBarChartProps) {
  const data = Object.entries(scoresAsn).map(([id, score]) => ({
    name: formatAsnName(id) || id,
    score,
  }));

  if (data.length === 0) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: '13px',
        }}
      >
        Aucune ASN disponible
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          margin={{ top: 16, right: 16, bottom: 8, left: 0 }}
          barCategoryGap="35%"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tickCount={5}
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip
            cursor={{ fill: 'var(--border-subtle)' }}
            contentStyle={{
              fontSize: 12,
              borderRadius: '8px',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-md)',
              background: 'var(--surface-container-lowest)',
              color: 'var(--text)',
            }}
            formatter={(value: number) => [`${value}%`, 'Score']}
          />
          {/* Ligne seuil excellence */}
          <ReferenceLine
            y={75}
            stroke="var(--success)"
            strokeDasharray="4 4"
            strokeWidth={1.5}
          />
          {/* Ligne seuil acceptable */}
          <ReferenceLine
            y={50}
            stroke="var(--warning)"
            strokeDasharray="4 4"
            strokeWidth={1.5}
          />
          <Bar dataKey="score" radius={[6, 6, 0, 0]}>
            <LabelList
              dataKey="score"
              position="top"
              style={{
                fontSize: 11,
                fill: 'var(--text-secondary)',
                fontWeight: 600,
              }}
              formatter={(v: number) => `${v}%`}
            />
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={couleurScore(entry.score)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Légende des seuils */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          justifyContent: 'center',
          flexWrap: 'wrap',
          marginTop: '8px',
        }}
      >
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '11px',
            color: 'var(--text-secondary)',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: '18px',
              height: '2px',
              background: 'var(--success)',
              borderRadius: '1px',
              position: 'relative',
            }}
            aria-hidden="true"
          />
          Seuil excellence (75%)
        </span>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '11px',
            color: 'var(--text-secondary)',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: '18px',
              height: '2px',
              background: 'var(--warning)',
              borderRadius: '1px',
            }}
            aria-hidden="true"
          />
          Seuil acceptable (50%)
        </span>
      </div>
    </div>
  );
}
