import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { usePilotageNationalStore } from '@/stores/pilotageNationalStore';
import { Grille2x2 } from '@/components/dashboard/pilotage/Grille2x2';
import { WatchlistFaritany } from '@/components/dashboard/pilotage/WatchlistFaritany';
import { KpiStrip, type KpiItem } from '@/components/dashboard/KpiStrip';
import { DrilldownFaritany, type DrilldownData } from '@/components/dashboard/pilotage/DrilldownFaritany';

export function PilotageNationalPage() {
  const { t } = useTranslation();
  const role = useAuthStore(s => s.role);
  const orgId = useAuthStore(s => s.orgId);
  const orgType = useAuthStore(s => s.orgType);
  const { rows, statsById, buckets, niveauLabel, nbEvalues, nbActionsNationalesEnCours, libellesKo, loading, error, loadPourUtilisateur, reset } = usePilotageNationalStore();
  const [selection, setSelection] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    void loadPourUtilisateur({ role, orgId, orgType });
    return reset;
  }, [role, orgId, orgType, loadPourUtilisateur, reset]);

  const drilldown: DrilldownData | null = useMemo(() => {
    if (!selection) return null;
    const r = rows.find(x => x.org.id === selection);
    if (!r) return null;
    return {
      nom: r.org.nom,
      essentielsKO: (statsById[selection]?.criteresEssentielsKO ?? []).map(code => ({ code, libelle: libellesKo[code] ?? code })),
      actionsRetard: r.actionsRetard,
      actionsBloque: r.actionsBloque,
    };
  }, [selection, rows, statsById, libellesKo]);

  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs font-bold tracking-widest text-[#454651] uppercase">{t('pages.pilotageNational.kicker', 'Cockpit décisionnel')}</span>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#15236e]">{t('pages.pilotageNational.title', 'Où concentrer l’appui')}</h1>
        <p className="text-[#454651] mt-1">
          {t('pages.pilotageNational.evalues', '{{n}} évalués / {{total}}', { n: nbEvalues, total: rows.length })}
        </p>
      </div>

      {error && <div className="p-4 bg-[#ffdad6] text-[#93000a] rounded-xl text-sm">{error}</div>}

      <KpiStrip loading={loading && rows.length === 0} kpis={[
        { label: t('pages.pilotageNational.kpiZoneAppui', 'Faritany en zone appui'), value: buckets.appuiUrgent, variant: buckets.appuiUrgent > 0 ? 'danger' : 'default' },
        { label: t('pages.pilotageNational.kpiAvecKo', 'Faritany avec essentiel KO'), value: buckets.appuiUrgent + buckets.conformite, variant: buckets.appuiUrgent + buckets.conformite > 0 ? 'warning' : 'default' },
        { label: t('pages.pilotageNational.kpiActionsNationales', 'Actions nationales en cours'), value: nbActionsNationalesEnCours, variant: 'default' },
      ] satisfies KpiItem[]} />

      <section className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#454651] mb-4">{t('pages.pilotageNational.repartition', 'Répartition sévérité × exécution')}</h2>
        <Grille2x2 buckets={buckets} />
      </section>

      <section className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#454651] mb-4">{t('pages.pilotageNational.watchlist', 'Watchlist')}</h2>
        {loading && rows.length === 0 ? (
          <p className="text-sm text-[#767682]">{t('common.chargement', 'Chargement…')}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-[#767682]">{t('pages.pilotageNational.aucunFaritany', 'Aucun Faritany.')}</p>
        ) : (
          <WatchlistFaritany rows={rows} niveauLabel={niveauLabel} onSelect={setSelection} />
        )}
      </section>

      <DrilldownFaritany data={drilldown} onClose={() => setSelection(null)} />
    </div>
  );
}
