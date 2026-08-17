import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useIndiceStore } from '@/stores/indiceStore';
import { AsnComparisonTable } from '@/components/dashboard/osn/AsnComparisonTable';
import { ExportPdfButton } from '@/components/shared/ExportPdfButton';
import { generateIndiceReport } from '@/services/pdf/indiceReport';
import type { IndiceCritereNational } from '@/services/indice/calculerIndiceDeploiement';

function badgeClass(interp: IndiceCritereNational['interpretation']): string {
  // Palette VOLONTAIREMENT distincte des scores GSAT (l'ID n'est pas une conformité).
  switch (interp) {
    case 'alerte':        return 'bg-rose-100 text-rose-800';
    case 'bonne_pratique':return 'bg-emerald-100 text-emerald-800';
    case 'coherent':      return 'bg-slate-100 text-slate-700';
    default:              return 'bg-slate-50 text-slate-400';
  }
}

export function IndiceDeploiementPage() {
  const { t } = useTranslation();
  const { resultats, faritany, dimensionCodes, niveauLabel, loading, error, load } = useIndiceStore();

  useEffect(() => { void load(); }, [load]);

  const hasData = resultats.length > 0 || faritany.length > 0;
  const handleExport = async () => {
    generateIndiceReport({
      national: resultats,
      faritany,
      dimensionCodes,
      niveauLabel: niveauLabel ?? undefined,
    }).save(`indice_deploiement_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{t('pages.indice.titre')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('pages.indice.sousTitre')}</p>
        </div>
        {hasData && <ExportPdfButton onExport={handleExport} compact />}
      </div>

      {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
      {loading && <p className="mt-4 text-sm text-slate-500">{t('pages.indice.chargement')}</p>}

      {!loading && resultats.length === 0 && (
        <p className="mt-6 text-sm text-slate-500">{t('pages.indice.vide')}</p>
      )}

      {resultats.length > 0 && (
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-2">{t('pages.indice.col.critere')}</th>
              <th className="py-2">{t('pages.indice.col.noteNationale')}</th>
              <th className="py-2">{t('pages.indice.col.id')}</th>
              <th className="py-2">{t('pages.indice.col.ecart')}</th>
              <th className="py-2">{t('pages.indice.col.interpretation')}</th>
            </tr>
          </thead>
          <tbody>
            {resultats.map((r) => (
              <tr key={r.code} className="border-t border-slate-100">
                <td className="py-2 font-medium">{r.code}</td>
                <td className="py-2">{r.noteNationale ?? '—'}</td>
                <td className="py-2">{r.id ?? '—'}</td>
                <td className="py-2">{r.ecart ?? '—'}</td>
                <td className="py-2">
                  {r.interpretation ? (
                    <span className={`rounded px-2 py-0.5 text-xs ${badgeClass(r.interpretation)}`}>
                      {t(`pages.indice.interpretation.${r.interpretation}`)}
                    </span>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {faritany.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">{t('pages.indice.comparaison.titre')}</h2>
          <p className="mt-1 text-sm text-slate-500">{t('pages.indice.comparaison.sousTitre')}</p>
          <div className="mt-4">
            <AsnComparisonTable
              rows={faritany}
              dimensionCodes={dimensionCodes}
              niveauLabel={niveauLabel ?? undefined}
            />
          </div>
        </section>
      )}
    </div>
  );
}
