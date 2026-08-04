import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Referentiel, DimensionDef } from '@/types';

interface ReferentielViewerProps {
  referentiel: Referentiel;
}

function DimensionAccordion({ dim }: { dim: DimensionDef }) {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fr';
  const [open, setOpen] = useState(false);

  const criteresActifs = dim.criteres.filter(c => c.actif);
  const nbEssentiels = criteresActifs.filter(c => c.essentiel).length;
  const noteMaxDim = criteresActifs.length * 3;

  return (
    <div className="rounded-xl" style={{ border: '1px solid var(--border)' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left rounded-xl hover:bg-gray-50"
        style={{ '--tw-bg-opacity': '1' } as React.CSSProperties}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
        onMouseLeave={e => (e.currentTarget.style.background = '')}
      >
        <div className="flex items-center gap-3">
          <span
            className="rounded-md px-2 py-0.5 text-xs font-bold"
            style={{ background: 'var(--info-light)', color: 'var(--info)' }}
          >
            {dim.code}
          </span>
          <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            {dim.nom[lang]}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>{criteresActifs.length} critères</span>
          {nbEssentiels > 0 && (
            <span
              className="rounded-full px-2 py-0.5"
              style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}
            >
              {nbEssentiels} essentiels
            </span>
          )}
          <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>/{noteMaxDim} pts</span>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <table className="min-w-full divide-y text-sm" style={{ '--tw-divide-opacity': '1' } as React.CSSProperties}>
            <thead style={{ background: 'var(--bg)' }}>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium w-16" style={{ color: 'var(--text-muted)' }}>Code</th>
                <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Libellé</th>
                <th className="px-4 py-2 text-center text-xs font-medium w-24" style={{ color: 'var(--text-muted)' }}>Essentiel</th>
                <th className="px-4 py-2 text-center text-xs font-medium w-20" style={{ color: 'var(--text-muted)' }}>Note max</th>
              </tr>
            </thead>
            <tbody style={{ background: 'var(--surface)' }}>
              {dim.criteres
                .filter(c => c.actif)
                .sort((a, b) => a.ordre - b.ordre)
                .map(critere => (
                  <tr
                    key={critere.code}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                    style={{ borderTop: '1px solid var(--border-subtle)' }}
                  >
                    <td className="px-4 py-2 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{critere.code}</td>
                    <td className="px-4 py-2" style={{ color: 'var(--text-secondary)' }}>{critere.libelle[lang]}</td>
                    <td className="px-4 py-2 text-center">
                      {critere.essentiel && (
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}
                        >
                          Essentiel
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>3</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ReferentielViewer({ referentiel }: ReferentielViewerProps) {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fr';

  const totalCriteres = referentiel.dimensions.flatMap(d => d.criteres.filter(c => c.actif)).length;
  const totalEssentiels = referentiel.dimensions
    .flatMap(d => d.criteres.filter(c => c.actif && c.essentiel)).length;

  return (
    <div className="space-y-4">
      {/* Résumé */}
      <div
        className="flex flex-wrap gap-4 rounded-xl px-5 py-4"
        style={{ background: 'var(--info-light)' }}
      >
        <div>
          <p className="text-xs font-medium" style={{ color: 'var(--info)' }}>Version</p>
          <p className="text-lg font-bold" style={{ color: '#1E3A5F' }}>{referentiel.version}</p>
        </div>
        <div>
          <p className="text-xs font-medium" style={{ color: 'var(--info)' }}>Nom</p>
          <p className="text-sm font-medium" style={{ color: '#1E3A5F' }}>{referentiel.nom[lang]}</p>
        </div>
        <div>
          <p className="text-xs font-medium" style={{ color: 'var(--info)' }}>Dimensions</p>
          <p className="text-lg font-bold" style={{ color: '#1E3A5F' }}>{referentiel.dimensions.length}</p>
        </div>
        <div>
          <p className="text-xs font-medium" style={{ color: 'var(--info)' }}>Critères actifs</p>
          <p className="text-lg font-bold" style={{ color: '#1E3A5F' }}>{totalCriteres}</p>
        </div>
        <div>
          <p className="text-xs font-medium" style={{ color: 'var(--info)' }}>Essentiels</p>
          <p className="text-lg font-bold" style={{ color: 'var(--warning)' }}>{totalEssentiels}</p>
        </div>
      </div>

      {/* Accordéons par dimension */}
      <div className="space-y-2">
        {referentiel.dimensions
          .sort((a, b) => a.ordre - b.ordre)
          .map(dim => (
            <DimensionAccordion key={dim.code} dim={dim} />
          ))}
      </div>
    </div>
  );
}
