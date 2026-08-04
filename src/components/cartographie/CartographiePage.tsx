import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { getOrganisationsAvecScores, subscribeOrganisationsRegion } from '@/services/cartoService';
import type { OrgAvecScore } from '@/services/cartoService';
import { CartoFilters } from './CartoFilters';
import type { ScoreRange } from './CartoFilters';
import { CartoLegend } from './CartoLegend';
import type { RegionCode } from '@/types';

const WorldMap = lazy(() => import('./WorldMap').then(m => ({ default: m.WorldMap })));

// ── Libellés courts des régions WOSM ─────────────────────────────────────────

const REGION_LABELS: Record<string, string> = {
  AFRICA:       'Afrique',
  ASIA_PACIFIC: 'Asie-Pacifique',
  ARAB:         'Arabe',
  INTERAMERICA: 'Interamérique',
  EUROPE:       'Europe',
  EURASIA:      'Eurasie',
};

// ── Couleur de score (CSS var — utilisable ici car dans React, pas SVG) ───────

function couleurScoreVar(score: number | null): string {
  if (score === null) return 'var(--text-muted)';
  if (score >= 75) return 'var(--score-excellent)';
  if (score >= 50) return 'var(--score-moyen)';
  if (score >= 25) return 'var(--score-faible)';
  return 'var(--score-critique)';
}

function bgScoreVar(score: number | null): string {
  if (score === null) return 'var(--surface-container)';
  if (score >= 75) return 'var(--success-light)';
  if (score >= 50) return 'var(--warning-light)';
  if (score >= 25) return 'rgba(249,115,22,0.12)';
  return 'var(--danger-light)';
}

// ── Bande de résumé par région ─────────────────────────────────────────────────

interface RegionStat {
  region: string;
  count: number;
  avgScore: number | null;
}

function RegionScoreStrip({ orgs }: { orgs: OrgAvecScore[] }) {
  const regionStats = useMemo<RegionStat[]>(() => {
    const acc: Record<string, { count: number; total: number; scored: number }> = {};

    orgs.forEach(({ org, stats }) => {
      const region = org.regionCode;
      if (!region) return;
      if (!acc[region]) acc[region] = { count: 0, total: 0, scored: 0 };
      acc[region].count++;
      if (stats?.scoreGlobal != null) {
        acc[region].total += stats.scoreGlobal;
        acc[region].scored++;
      }
    });

    return Object.entries(acc)
      .map(([region, d]) => ({
        region,
        count: d.count,
        avgScore: d.scored > 0 ? Math.round(d.total / d.scored) : null,
      }))
      .sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1));
  }, [orgs]);

  if (regionStats.length === 0) return null;

  return (
    <div
      style={{
        background: 'var(--surface-container-lowest)',
        boxShadow: '0 -2px 10px -2px rgba(23,28,34,0.07)',
        padding: '12px 20px',
        display: 'flex',
        gap: '10px',
        overflowX: 'auto',
        flexShrink: 0,
      }}
    >
      {regionStats.map(({ region, count, avgScore }) => {
        const color = couleurScoreVar(avgScore);
        const bg = bgScoreVar(avgScore);

        return (
          <div
            key={region}
            style={{
              flexShrink: 0,
              background: 'var(--surface-container-lowest)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-xs)',
              padding: '10px 16px',
              minWidth: '120px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              transition: 'box-shadow 150ms ease, transform 150ms ease',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.boxShadow = 'var(--shadow-sm)';
              el.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.boxShadow = 'var(--shadow-xs)';
              el.style.transform = 'translateY(0)';
            }}
          >
            {/* Région label */}
            <p
              style={{
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {REGION_LABELS[region] ?? region}
            </p>

            {/* Score moyen */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
              <span
                style={{
                  fontSize: '22px',
                  fontWeight: 800,
                  fontFamily: 'var(--font-headline)',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                  color,
                }}
              >
                {avgScore ?? '—'}
              </span>
              {avgScore !== null && (
                <span style={{ fontSize: '12px', fontWeight: 600, color }}>%</span>
              )}
            </div>

            {/* Compteur OSN + mini badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  borderRadius: 'var(--radius-full)',
                  padding: '1px 7px',
                  background: bg,
                  color,
                }}
              >
                {count} OSN
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────

export function CartographiePage() {
  const { t } = useTranslation();

  const [tousLesOrgs, setTousLesOrgs] = useState<OrgAvecScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [regionSelectionnee, setRegionSelectionnee] = useState<RegionCode | 'TOUTES'>('TOUTES');
  const [scoreRange, setScoreRange] = useState<ScoreRange>('tous');

  useEffect(() => {
    setLoading(true);
    setError(null);

    if (regionSelectionnee === 'TOUTES') {
      getOrganisationsAvecScores()
        .then(data => { setTousLesOrgs(data); setLoading(false); })
        .catch(err => { setError((err as Error).message); setLoading(false); });
      return;
    }

    const unsubscribe = subscribeOrganisationsRegion(
      regionSelectionnee,
      data => { setTousLesOrgs(data); setLoading(false); },
      err => { setError(err.message); setLoading(false); }
    );

    return unsubscribe;
  }, [regionSelectionnee]);

  const orgsFiltrees = useMemo<OrgAvecScore[]>(() => {
    if (scoreRange === 'tous') return tousLesOrgs;
    return tousLesOrgs.filter(({ stats }) => {
      const score = stats?.scoreGlobal;
      if (score == null) return false;
      if (scoreRange === 'excellent') return score >= 75;
      if (scoreRange === 'moyen')     return score >= 50 && score < 75;
      if (scoreRange === 'faible')    return score < 50;
      return true;
    });
  }, [tousLesOrgs, scoreRange]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 64px)',
      }}
    >
      {/* ── Filtres ── */}
      <CartoFilters
        regionSelectionnee={regionSelectionnee}
        onRegionChange={reg => setRegionSelectionnee(reg)}
        scoreRange={scoreRange}
        onScoreRangeChange={setScoreRange}
        nbOsnAffichees={orgsFiltrees.length}
      />

      {/* ── Zone carte (flex-1 = takes remaining space) ── */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        {/* Loading overlay */}
        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 2000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--glass-bg)',
              backdropFilter: 'var(--glass-blur)',
              WebkitBackdropFilter: 'var(--glass-blur)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <div
                className="animate-spin"
                style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  border: '3px solid var(--primary-light)',
                  borderTopColor: 'var(--primary)',
                }}
              />
              <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                {t('common.chargement')}
              </p>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 2000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.92)',
            }}
          >
            <div
              style={{
                borderRadius: 'var(--radius-2xl)',
                padding: '24px',
                maxWidth: '360px',
                textAlign: 'center',
                background: 'var(--surface-container-lowest)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <p style={{ fontSize: '13px', color: 'var(--danger)' }}>
                {t('common.erreurChargement')} : {error}
              </p>
            </div>
          </div>
        )}

        {/* Map + Legend */}
        {!loading && !error && (
          <Suspense
            fallback={
              <div
                style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <div
                  className="animate-spin"
                  style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    border: '3px solid var(--primary-light)',
                    borderTopColor: 'var(--primary)',
                  }}
                />
              </div>
            }
          >
            <WorldMap orgs={orgsFiltrees} />
            <CartoLegend />
          </Suspense>
        )}
      </div>

      {/* ── Bande de scores régionaux ── */}
      {!loading && !error && tousLesOrgs.length > 0 && (
        <RegionScoreStrip orgs={tousLesOrgs} />
      )}
    </div>
  );
}
