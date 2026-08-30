/**
 * PilotageOsnPage — Pilotage des plans d'action nationaux OSN
 * Source Stitch : pilotage_des_plans_d_action_nationaux_osn/code.html
 * KPI grid border-bottom accent, OSN list with inline progress, filters
 * Donnees Supabase : plans d'action + organisations ASN filles de l'OSN courant
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { listOrganisations } from '@/services/organisationService';
import { listActionAggByOrgIds } from '@/services/planActionService';
import type { Organisation, PlanAction, Action, ActionStatut } from '@/types';

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

type Conformity = 'conforme' | 'non-conforme' | 'all';

interface AsnPlanSummary {
  id: string;
  orgId: string;
  name: string;
  region: string;
  actions_total: number;
  actions_done: number;
  actions_en_cours: number;
  actions_bloque: number;
  score: number;
  conformity: 'conforme' | 'non-conforme';
  last_update: string;
}

const CONFORMITY_THRESHOLD = 50; // score minimum pour etre conforme

// ── Region label helper ───────────────────────────────────────────────────

function regionLabel(code: string | undefined): string {
  const map: Record<string, string> = {
    AFRICA: 'Afrique',
    ASIA_PACIFIC: 'Asie-Pacifique',
    ARAB: 'Arabe',
    INTERAMERICA: 'Ameriques',
    EUROPE: 'Europe',
    EURASIA: 'Eurasie',
  };
  return code ? (map[code] ?? code) : '—';
}

// ── Date formatting helper ────────────────────────────────────────────────

function formatDate(iso: string | Date | undefined | null): string {
  if (!iso) return '—';
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function PilotageOsnPage() {
  const { t } = useTranslation();
  const { orgId } = useAuthStore();
  const [regionFilter, setRegionFilter] = useState('Toutes les Regions');
  const [conformityFilter, setConformityFilter] = useState<Conformity>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [asnSummaries, setAsnSummaries] = useState<AsnPlanSummary[]>([]);

  // ── Load ASN data ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function loadData() {
      try {
        // 1. Get all ASN organisations whose parentId is our OSN orgId
        const allAsn = await listOrganisations('ASN');
        const childAsn = allAsn.filter(org => org.parentId === orgId);

        // 2. Audit M7 : une seule requête batchée (plans + actions jointes) au
        // lieu du N+1 (33 ASN × plans × listActions séquentiel).
        const aggByOrg = await listActionAggByOrgIds(childAsn.map(a => a.id));

        const summaries: AsnPlanSummary[] = childAsn.map((asn: Organisation) => {
          const agg = aggByOrg[asn.id] ?? {
            actionsTotal: 0, actionsDone: 0, actionsEnCours: 0, actionsBloque: 0,
            latestUpdate: null,
          };
          const score = agg.actionsTotal > 0
            ? Math.round((agg.actionsDone / agg.actionsTotal) * 100)
            : 0;
          return {
            id: asn.id,
            orgId: asn.id,
            name: asn.nom,
            region: regionLabel(asn.regionCode),
            actions_total: agg.actionsTotal,
            actions_done: agg.actionsDone,
            actions_en_cours: agg.actionsEnCours,
            actions_bloque: agg.actionsBloque,
            score,
            conformity: score >= CONFORMITY_THRESHOLD ? 'conforme' : 'non-conforme',
            last_update: agg.latestUpdate ? formatDate(new Date(agg.latestUpdate)) : '—',
          };
        });

        if (!cancelled) {
          setAsnSummaries(summaries);
          setLoading(false);
        }
      } catch (err) {
        console.error('[PilotageOsn] loadData failed:', err);
        if (!cancelled) {
          setError(t('common.error', 'Erreur lors du chargement'));
          setLoading(false);
        }
      }
    }

    void loadData();
    return () => { cancelled = true; };
  }, [orgId, t]);

  // ── Derived values ───────────────────────────────────────────────────────

  const regions = useMemo(() => {
    const set = new Set(asnSummaries.map(o => o.region));
    return ['Toutes les Regions', ...Array.from(set).sort()];
  }, [asnSummaries]);

  const filtered = useMemo(() => {
    return asnSummaries.filter(o => {
      const matchRegion = regionFilter === 'Toutes les Regions' || o.region === regionFilter;
      const matchConformity = conformityFilter === 'all' || o.conformity === conformityFilter;
      return matchRegion && matchConformity;
    });
  }, [asnSummaries, regionFilter, conformityFilter]);

  const totalActions = asnSummaries.reduce((acc, o) => acc + o.actions_total, 0);
  const doneActions = asnSummaries.reduce((acc, o) => acc + o.actions_done, 0);
  const globalCompletion = totalActions > 0 ? Math.round((doneActions / totalActions) * 100) : 0;
  const conformeCount = asnSummaries.filter(o => o.conformity === 'conforme').length;
  const alertCount = asnSummaries.filter(o => o.conformity === 'non-conforme').length;

  // ── Loading / error states ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <span className="material-symbols-outlined animate-spin text-[32px]" style={{ color: 'var(--primary)' }}>
          progress_activity
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-[1400px] mx-auto">
        <div
          className="p-6 text-center"
          style={{
            background: 'var(--error-container)',
            color: 'var(--on-error-container)',
            borderRadius: 'var(--radius-xl)',
          }}
        >
          <Icon name="error" size={32} />
          <p className="mt-2 font-semibold">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-[1400px] mx-auto w-full">

      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1
            className="text-3xl font-extrabold tracking-tight mb-2"
            style={{ color: 'var(--primary)', fontFamily: 'var(--font-headline)' }}
          >
            {t('pilotage.title', 'Tableau de bord de pilotage')}
          </h1>
          <p className="text-sm flex items-center gap-2" style={{ color: 'var(--on-surface-variant)' }}>
            <span
              className="w-2 h-2"
              style={{ background: 'var(--secondary)', borderRadius: '50%' }}
            />
            {t('pilotage.subtitle', 'Mise a jour en temps reel — Niveau National (OSN)')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Region filter */}
          <div className="relative">
            <select
              value={regionFilter}
              onChange={e => setRegionFilter(e.target.value)}
              className="appearance-none px-4 py-2 pr-10 text-sm font-medium outline-none"
              style={{
                background: 'var(--surface-container-high)',
                border: 'none',
                borderRadius: 'var(--radius-xl)',
                color: 'var(--on-surface)',
                cursor: 'pointer',
              }}
              onFocus={e => (e.currentTarget as HTMLElement).style.outline = '2px solid var(--primary)'}
              onBlur={e => (e.currentTarget as HTMLElement).style.outline = 'none'}
            >
              {regions.map(r => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <span
              className="absolute right-3 top-2 pointer-events-none"
              style={{ color: 'var(--outline)' }}
            >
              <Icon name="expand_more" size={18} />
            </span>
          </div>

          {/* Conformity filter */}
          <div className="relative">
            <select
              value={conformityFilter}
              onChange={e => setConformityFilter(e.target.value as Conformity)}
              className="appearance-none px-4 py-2 pr-10 text-sm font-medium outline-none"
              style={{
                background: 'var(--surface-container-high)',
                border: 'none',
                borderRadius: 'var(--radius-xl)',
                color: 'var(--on-surface)',
                cursor: 'pointer',
              }}
            >
              <option value="all">{t('pilotage.conformityAll', 'Conformite : Tous')}</option>
              <option value="conforme">{t('pilotage.conforme', 'Conforme')}</option>
              <option value="non-conforme">{t('pilotage.nonConforme', 'Non-conforme')}</option>
            </select>
            <span
              className="absolute right-3 top-2 pointer-events-none"
              style={{ color: 'var(--outline)' }}
            >
              <Icon name="filter_list" size={18} />
            </span>
          </div>
        </div>
      </section>

      {/* KPI Grid — border-bottom accent (Stitch pilotage pattern) */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          {
            label: t('pilotage.totalActions', 'Actions Totales'),
            value: totalActions.toLocaleString(),
            sub: `${doneActions} ${t('pilotage.completed', 'terminees')}`,
            subColor: 'var(--secondary)',
            subBg: 'var(--secondary-container)',
            accent: 'var(--primary)',
          },
          {
            label: t('pilotage.globalCompletion', 'Realisation Globale'),
            value: `${globalCompletion}%`,
            sub: `${doneActions}/${totalActions}`,
            subColor: 'var(--outline)',
            subBg: 'transparent',
            accent: 'var(--secondary)',
            progress: globalCompletion,
          },
          {
            label: t('pilotage.conformes', 'ASN Conformes'),
            value: `${conformeCount}/${asnSummaries.length}`,
            sub: asnSummaries.length > 0
              ? `${Math.round((conformeCount / asnSummaries.length) * 100)}%`
              : '0%',
            subColor: 'var(--secondary)',
            subBg: 'var(--secondary-container)',
            accent: 'var(--secondary)',
          },
          {
            label: t('pilotage.alerts', 'En alerte'),
            value: `${alertCount}`,
            sub: t('pilotage.belowThreshold', 'ASN sous le seuil'),
            subColor: 'var(--error)',
            subBg: 'transparent',
            accent: 'var(--error)',
          },
        ].map(kpi => (
          <div
            key={kpi.label}
            className="p-6"
            style={{
              background: 'var(--surface-container-lowest)',
              boxShadow: 'var(--shadow-card)',
              borderRadius: 'var(--radius-xl)',
              borderBottom: `4px solid ${kpi.accent}`,
            }}
          >
            <p
              className="text-xs font-bold uppercase tracking-wider mb-1"
              style={{ color: 'var(--on-surface-variant)', fontFamily: 'var(--font-headline)' }}
            >
              {kpi.label}
            </p>
            <div className="flex items-end justify-between">
              <h3
                className="text-4xl font-extrabold"
                style={{ color: 'var(--primary)', fontFamily: 'var(--font-headline)' }}
              >
                {kpi.value}
              </h3>
              <span
                className="text-xs font-bold px-2 py-1"
                style={{
                  color: kpi.subColor,
                  background: kpi.subBg,
                  borderRadius: 'var(--radius-full)',
                }}
              >
                {kpi.sub}
              </span>
            </div>
            {'progress' in kpi && (
              <div
                className="mt-3 h-1.5 w-full overflow-hidden"
                style={{ background: 'var(--surface-container-highest)', borderRadius: 'var(--radius-full)' }}
              >
                <div
                  style={{
                    width: `${kpi.progress}%`,
                    height: '100%',
                    background: 'var(--secondary)',
                    borderRadius: 'var(--radius-full)',
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </section>

      {/* ASN table */}
      <div
        className="overflow-hidden"
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
            {t('pilotage.tableTitle', "Plans d'action par ASN")}
          </h3>
          <span className="text-xs font-semibold" style={{ color: 'var(--outline)' }}>
            {filtered.length} / {asnSummaries.length} ASN
          </span>
        </div>

        {asnSummaries.length === 0 ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-[48px] mb-3 block" style={{ color: 'var(--outline)' }}>
              inbox
            </span>
            <p className="text-sm" style={{ color: 'var(--on-surface-variant)' }}>
              {t('pilotage.noData', "Aucune ASN ou plan d'action trouve pour cette organisation.")}
            </p>
          </div>
        ) : (
          <table className="min-w-full">
            <thead style={{ background: 'var(--surface-container-low)' }}>
              <tr>
                {[
                  t('pilotage.colAsn', 'ASN'),
                  t('pilotage.colRegion', 'Region'),
                  t('pilotage.colScore', 'Avancement'),
                  t('pilotage.colActions', 'Actions'),
                  t('pilotage.colProgress', 'Progression'),
                  t('pilotage.colConformity', 'Conformite'),
                  t('pilotage.colLastUpdate', 'Derniere MAJ'),
                ].map(h => (
                  <th key={h} className="px-6 py-4 text-left label-caps" style={{ borderBottom: '1px solid rgba(198,197,210,0.1)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((asn, i) => {
                const completion = asn.actions_total > 0
                  ? Math.round((asn.actions_done / asn.actions_total) * 100)
                  : 0;
                return (
                  <tr
                    key={asn.id}
                    style={{
                      borderTop: i > 0 ? '1px solid rgba(198,197,210,0.06)' : undefined,
                      transition: 'background var(--transition)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-container-low)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold" style={{ color: 'var(--on-surface)' }}>{asn.name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm" style={{ color: 'var(--on-surface-variant)' }}>{asn.region}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className="text-sm font-bold"
                        style={{
                          color: asn.score >= 70 ? 'var(--secondary)' : asn.score >= 50 ? 'var(--warning-dark)' : 'var(--error)',
                          fontFamily: 'var(--font-headline)',
                        }}
                      >
                        {asn.score}%
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm" style={{ color: 'var(--on-surface)' }}>
                        {asn.actions_done}/{asn.actions_total}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1 w-32">
                        <div className="flex justify-between text-xs">
                          <span style={{ color: 'var(--outline)' }}>{completion}%</span>
                        </div>
                        <div
                          className="h-1.5 overflow-hidden"
                          style={{ background: 'var(--surface-container-highest)', borderRadius: 'var(--radius-full)' }}
                        >
                          <div
                            style={{
                              width: `${completion}%`,
                              height: '100%',
                              background: completion >= 70 ? 'var(--secondary)' : completion >= 40 ? 'var(--warning)' : 'var(--error)',
                              borderRadius: 'var(--radius-full)',
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold"
                        style={{
                          background: asn.conformity === 'conforme' ? 'var(--secondary-container)' : 'var(--error-container)',
                          color: asn.conformity === 'conforme' ? 'var(--secondary)' : 'var(--error)',
                          borderRadius: 'var(--radius-full)',
                        }}
                      >
                        {asn.conformity === 'conforme'
                          ? t('pilotage.conforme', 'Conforme')
                          : t('pilotage.nonConforme', 'Non-conforme')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs" style={{ color: 'var(--on-surface-variant)' }}>{asn.last_update}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
