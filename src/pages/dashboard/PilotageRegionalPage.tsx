import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { usePilotageRegionalStore } from '@/stores/pilotageRegionalStore';
import { KpiStrip, type KpiItem } from '@/components/dashboard/KpiStrip';
import { FilePriorites } from '@/components/dashboard/pilotage/FilePriorites';

export function PilotageRegionalPage() {
  const { t } = useTranslation();
  const orgId = useAuthStore(s => s.orgId);
  const { items, evalue, actionsTerminees, koCount, retardCount, bloqueCount, loading, error, load, reset } = usePilotageRegionalStore();

  useEffect(() => {
    if (!orgId) return;
    void load(orgId);
    return reset;
  }, [orgId, load, reset]);

  const kpis: KpiItem[] = [
    { label: t('pages.pilotageRegional.koLabel', 'Essentiels KO'), value: koCount, variant: koCount > 0 ? 'danger' : 'success' },
    { label: t('pages.pilotageRegional.retardLabel', 'Actions en retard'), value: retardCount, variant: retardCount > 0 ? 'warning' : 'default' },
    { label: t('pages.pilotageRegional.bloqueLabel', 'Actions bloquées'), value: bloqueCount, variant: bloqueCount > 0 ? 'danger' : 'default' },
    { label: t('pages.pilotageRegional.termineesLabel', 'Terminées'), value: actionsTerminees, variant: 'default' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs font-bold tracking-widest text-[#454651] uppercase">{t('pages.pilotageRegional.kicker', 'Cockpit décisionnel')}</span>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#15236e]">{t('pages.pilotageRegional.title', 'Mes priorités d’action')}</h1>
      </div>

      {error && <div className="p-4 bg-[#ffdad6] text-[#93000a] rounded-xl text-sm">{error}</div>}

      <KpiStrip kpis={kpis} loading={loading && !evalue && items.length === 0} />

      <section className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#454651] mb-4">{t('pages.pilotageRegional.file', 'File de priorités')}</h2>
        <FilePriorites items={items} evalue={evalue} actionsTerminees={actionsTerminees} />
      </section>
    </div>
  );
}
