import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { useDashboardFaritanyStore } from '@/stores/dashboardFaritanyStore';
import { KpiStrip, type KpiItem } from '@/components/dashboard/KpiStrip';
import { DimensionRadarChart } from '@/components/dashboard/DimensionRadarChart';
import { ActionKanban } from '@/components/plan/ActionKanban';
import type { AlerteSeverite } from '@/types';

function scoreVariant(score: number | undefined): 'default' | 'success' | 'warning' | 'danger' {
  if (score === undefined) return 'default';
  if (score >= 75) return 'success';
  if (score >= 50) return 'default';
  if (score >= 25) return 'warning';
  return 'danger';
}

const SEVERITE_STYLE: Record<AlerteSeverite, { bg: string; text: string }> = {
  critique:  { bg: 'bg-[#ffdad6]', text: 'text-[#ba1a1a]' },
  vigilance: { bg: 'bg-[#ffe6c0]', text: 'text-[#8a5a00]' },
  info:      { bg: 'bg-[#e4e8f1]', text: 'text-[#454651]' },
};

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-[#ffffff] rounded-2xl shadow-sm p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#454651]">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function DashboardFaritanyPage() {
  const { t } = useTranslation();
  const { orgId } = useAuthStore();
  const { stats, moyenne, alertes, actions, erp, loading, load, reset } = useDashboardFaritanyStore();

  useEffect(() => {
    if (!orgId) return;
    void load(orgId);
    return reset;
  }, [orgId, load, reset]);

  const nbCritiques = alertes.filter(a => a.severite === 'critique').length;

  const kpis: KpiItem[] = [
    { label: t('pages.dashboardFaritany.scoreGlobal'), value: stats ? Math.round(stats.scoreGlobal) : '—', subLabel: '/100', variant: scoreVariant(stats?.scoreGlobal) },
    // Évolution différée : pas de snapshot historique dans dashboard_stats, mais la
    // source existe (diff des scoreGlobal des deux dernières évaluations clôturées,
    // un cycle = une campagne). À câbler dans une slice dédiée.
    { label: t('pages.dashboardFaritany.evolution'), value: '—', subLabel: t('pages.dashboardFaritany.evolutionIndisponible') },
    { label: t('pages.dashboardFaritany.alertesCritiques'), value: nbCritiques, variant: nbCritiques > 0 ? 'danger' : 'success' },
    { label: t('pages.dashboardFaritany.moyenneNationale'), value: moyenne ? Math.round(moyenne.scoreGlobal) : '—', subLabel: '/100' },
  ];

  const erpIndicateurs = erp ? Object.entries(erp.indicateurs) : [];
  const erpDate = erp ? new Date(erp.periode).toLocaleDateString('fr-FR') : '';

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#15236e] font-headline">
          {t('pages.dashboardFaritany.title')}
        </h1>
        <p className="text-[#454651] mt-1">{t('pages.dashboardFaritany.subtitle')}</p>
      </div>

      {/* Bandeau 1 — KPIs (score, évolution, alertes critiques, moyenne) */}
      <KpiStrip kpis={kpis} loading={loading && !stats} />

      {/* Bandeau 2 — Score par dimension vs moyenne nationale */}
      <Section
        title={t('pages.dashboardFaritany.radar')}
        aside={moyenne ? (
          <span className="text-xs font-semibold text-[#767682]">
            {t('pages.dashboardFaritany.radarMoyenne', { score: Math.round(moyenne.scoreGlobal) })}
          </span>
        ) : undefined}
      >
        <DimensionRadarChart scoreParDimension={stats?.scoreParDimension ?? {}} />
      </Section>

      {/* Bandeau 3 — ERP : masqué entièrement s'il n'y a aucun snapshot */}
      {erpIndicateurs.length > 0 && (
        <Section
          title={t('pages.dashboardFaritany.erp')}
          aside={<span className="text-xs text-[#767682]">{t('pages.dashboardFaritany.erpAu', { date: erpDate })}</span>}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {erpIndicateurs.map(([cle, valeur]) => (
              <div key={cle} className="bg-[#f0f4fd] rounded-lg px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-[#767682] truncate" title={cle}>{cle}</p>
                <p className="text-lg font-bold text-[#15236e] tabular-nums">{String(valeur)}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Bandeau 4 — Alertes (5 max, triées par sévérité) */}
      <Section title={t('pages.dashboardFaritany.alertes')}>
        {alertes.length === 0 ? (
          <p className="text-sm text-[#767682]">{t('pages.dashboardFaritany.aucuneAlerte')}</p>
        ) : (
          <ul className="space-y-2">
            {alertes.map(a => {
              const s = SEVERITE_STYLE[a.severite];
              return (
                <li key={a.id} className="flex items-start gap-3 p-3 rounded-lg bg-[#f8f9ff]">
                  <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
                    {t(`pages.dashboardFaritany.severites.${a.severite}`)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#171c22]">{a.titre}</p>
                    {a.detail && <p className="text-xs text-[#454651] mt-0.5">{a.detail}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* Bandeau 5 — Plan d'action */}
      <Section title={t('pages.dashboardFaritany.planAction')}>
        {actions.length === 0 ? (
          <p className="text-sm text-[#767682]">{t('pages.dashboardFaritany.aucuneAction')}</p>
        ) : (
          <ActionKanban actions={actions} />
        )}
      </Section>
    </div>
  );
}
