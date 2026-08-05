import { useState, useMemo, Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { grouperAsnParProvince, seuilQuartileBas, type LigneAsn } from '@/utils/asnTableau'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AsnRow extends LigneAsn {
  dernierAudit?: string
}

interface AsnComparisonTableProps {
  rows: AsnRow[]
  dimensionCodes: string[]
  /** Libellé du niveau local (system_config.libelle_niveau_local) — jamais « ASN » en dur. */
  niveauLabel?: string | undefined
}

// ── Helpers couleur heatmap ───────────────────────────────────────────────────

function heatmapBg(score: number): string {
  if (score >= 75) return 'bg-[#b9eeab] text-[#002201]'
  if (score >= 50) return 'bg-[#dee0ff] text-[#000f5c]'
  if (score >= 25) return 'bg-amber-100 text-amber-900'
  return 'bg-[#ffdad6] text-[#93000a]'
}

function globalScoreColor(score: number): string {
  if (score >= 75) return 'text-[#3b6934]'
  if (score >= 50) return 'text-[#15236e]'
  if (score >= 25) return 'text-amber-600'
  return 'text-[#ba1a1a]'
}

// ── Composant ─────────────────────────────────────────────────────────────────

/**
 * Tableau national ASN × dimensions. Conçu pour 33 lignes : groupes repliables
 * par province, tri par colonne, et mise en avant du quartile bas (les Faritany
 * les plus en difficulté) plutôt qu'un affichage exhaustif.
 */
export function AsnComparisonTable({ rows, dimensionCodes, niveauLabel }: AsnComparisonTableProps) {
  const { t } = useTranslation()
  const [triCle, setTriCle] = useState<string | null>(null) // null = score global
  const [triAsc, setTriAsc] = useState(false)
  // Override explicite d'ouverture par province ; par défaut un groupe est ouvert
  // s'il contient un Faritany du quartile bas (mise en avant sans clic).
  const [toggled, setToggled] = useState<Record<string, boolean>>({})

  const seuil = useMemo(() => seuilQuartileBas(rows.map(r => r.scoreGlobal)), [rows])
  const groupes = useMemo(() => grouperAsnParProvince(rows, triCle, triAsc), [rows, triCle, triAsc])
  const nbSurveiller = useMemo(() => rows.filter(r => r.scoreGlobal <= seuil).length, [rows, seuil])

  function trier(cle: string | null) {
    if (triCle === cle) setTriAsc(v => !v)
    else { setTriCle(cle); setTriAsc(false) }
  }
  const estOuvert = (g: { prefixe: string; lignes: { scoreGlobal: number }[] }) =>
    toggled[g.prefixe] ?? g.lignes.some(l => l.scoreGlobal <= seuil)
  function bascule(g: { prefixe: string; lignes: { scoreGlobal: number }[] }) {
    setToggled(m => ({ ...m, [g.prefixe]: !estOuvert(g) }))
  }

  const colLabel = niveauLabel ?? t('common.association', 'Association')

  if (rows.length === 0) {
    return (
      <div className="bg-[#ffffff] rounded-2xl shadow-sm p-8 text-center border border-[#c6c5d2]/5">
        <span className="material-symbols-outlined text-[#c6c5d2] text-4xl">table_chart</span>
        <p className="text-[#454651] text-sm mt-3">{t('dashboard.aucuneDonnee', 'Aucune donnée disponible')}</p>
      </div>
    )
  }

  const SortHeader = ({ cle, label, extra = '' }: { cle: string | null; label: string; extra?: string }) => (
    <th className={`px-3 py-4 text-xs font-bold text-[#454651] uppercase tracking-wider whitespace-nowrap cursor-pointer select-none ${extra}`} onClick={() => trier(cle)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {triCle === cle && <span className="material-symbols-outlined text-[14px]">{triAsc ? 'arrow_upward' : 'arrow_downward'}</span>}
      </span>
    </th>
  )

  const nbCols = 3 + dimensionCodes.length

  return (
    <div className="bg-[#ffffff] rounded-2xl shadow-sm overflow-hidden border border-[#c6c5d2]/5">
      <div className="p-6 border-b border-[#c6c5d2]/10 flex justify-between items-center gap-3 flex-wrap">
        <h4 className="font-headline font-bold text-[#15236e]">
          {t('pages.dashboardOsn.apercuRegional', 'Aperçu national')}
        </h4>
        {nbSurveiller > 0 && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#ffdad6] text-[#93000a]">
            {t('pages.dashboardOsn.quartileBas', { count: nbSurveiller })}
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-[#e4e8f1]">
              <th className="px-6 py-4 text-xs font-bold text-[#454651] uppercase tracking-wider whitespace-nowrap">{colLabel}</th>
              <SortHeader cle={null} label={t('common.score', 'Score')} extra="text-center" />
              <th className="px-4 py-4 text-xs font-bold text-[#454651] uppercase tracking-wider whitespace-nowrap">{t('common.status', 'Statut')}</th>
              {dimensionCodes.map(code => <SortHeader key={code} cle={code} label={code} extra="text-center" />)}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#c6c5d2]/10">
            {groupes.map(g => {
              const open = estOuvert(g)
              const nbBas = g.lignes.filter(l => l.scoreGlobal <= seuil).length
              return (
                <Fragment key={g.prefixe}>
                  {/* En-tête province repliable */}
                  <tr className="bg-[#f0f4fd] cursor-pointer hover:bg-[#e4e8f1]" onClick={() => bascule(g)}>
                    <td colSpan={nbCols} className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-[#454651]" style={{ transform: open ? 'rotate(90deg)' : 'none' }}>chevron_right</span>
                        <span className="font-bold text-[#15236e]">{g.nom}</span>
                        <span className="text-xs text-[#454651]">({g.lignes.length})</span>
                        <span className={`text-xs font-bold ml-1 ${globalScoreColor(g.moyenne)}`}>{g.moyenne}%</span>
                        {nbBas > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#ffdad6] text-[#93000a] ml-auto">{t('pages.dashboardOsn.quartileBas', { count: nbBas })}</span>}
                      </div>
                    </td>
                  </tr>
                  {open && g.lignes.map(row => {
                    const bas = row.scoreGlobal <= seuil
                    return (
                      <tr key={row.asnId} className="hover:bg-[#f0f4fd] transition-colors" style={bas ? { borderLeft: '3px solid #ba1a1a', background: 'rgba(255,218,214,0.25)' } : undefined}>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#15236e]">{row.nom}</span>
                            {bas && <span className="material-symbols-outlined text-[15px] text-[#ba1a1a]" title={t('pages.dashboardOsn.aSurveiller', 'À surveiller')}>priority_high</span>}
                          </div>
                          {row.dernierAudit && <div className="text-[10px] text-[#454651] uppercase">{row.dernierAudit}</div>}
                        </td>
                        <td className="px-4 py-3 text-center"><span className={`font-headline font-bold ${globalScoreColor(row.scoreGlobal)}`}>{row.scoreGlobal}%</span></td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-1 rounded-lg text-xs font-bold ${heatmapBg(row.scoreGlobal)}`}>{row.scoreGlobal >= 50 ? '✓' : '!'}</span>
                        </td>
                        {dimensionCodes.map(code => {
                          const d = row.scoreParDimension[code] ?? 0
                          return <td key={code} className="px-3 py-3 text-center"><span className={`inline-block px-2 py-1 rounded-lg text-xs font-bold min-w-[40px] ${heatmapBg(d)}`}>{d}%</span></td>
                        })}
                      </tr>
                    )
                  })}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
