import { useTranslation } from 'react-i18next'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AsnRow {
  asnId: string
  nom: string
  scoreGlobal: number
  scoreParDimension: Record<string, number>
  dernierAudit?: string
}

interface AsnComparisonTableProps {
  rows: AsnRow[]
  dimensionCodes: string[]
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

function statusLabel(score: number): { label: string; cls: string } {
  if (score >= 75) return { label: 'Excellence', cls: 'bg-[#b9eeab] text-[#23501e]' }
  if (score >= 50) return { label: 'Conforme', cls: 'bg-[#dee0ff] text-[#33408a]' }
  if (score >= 25) return { label: 'En cours', cls: 'bg-amber-100 text-amber-800' }
  return { label: 'Critique', cls: 'bg-[#ffdad6] text-[#93000a]' }
}

// ── Composant ─────────────────────────────────────────────────────────────────

/**
 * Tableau ASN × dimensions avec heatmap colorée.
 * Design Stitch : table sans bordures extérieures, shadow-sm, rounded-2xl.
 */
export function AsnComparisonTable({ rows, dimensionCodes }: AsnComparisonTableProps) {
  const { t } = useTranslation()

  if (rows.length === 0) {
    return (
      <div className="bg-[#ffffff] rounded-2xl shadow-sm p-8 text-center border border-[#c6c5d2]/5">
        <span className="material-symbols-outlined text-[#c6c5d2] text-4xl">table_chart</span>
        <p className="text-[#454651] text-sm mt-3">
          {t('dashboard.aucuneDonnee', 'Aucune donnée disponible')}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-[#ffffff] rounded-2xl shadow-sm overflow-hidden border border-[#c6c5d2]/5">
      <div className="p-6 border-b border-[#c6c5d2]/10 flex justify-between items-center">
        <h4 className="font-headline font-bold text-[#15236e]">
          {t('pages.dashboardOsn.apercuRegional', 'Aperçu Régional des ASN')}
        </h4>
        <span className="text-xs text-[#454651] italic">
          {t('pages.dashboardOsn.comparaisonNationale', 'Comparaison nationale vs objectif')}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-[#e4e8f1]">
              <th className="px-6 py-4 text-xs font-bold text-[#454651] uppercase tracking-wider whitespace-nowrap">
                {t('common.association', 'Association')}
              </th>
              <th className="px-4 py-4 text-xs font-bold text-[#454651] uppercase tracking-wider text-center whitespace-nowrap">
                {t('common.score', 'Score')}
              </th>
              <th className="px-4 py-4 text-xs font-bold text-[#454651] uppercase tracking-wider whitespace-nowrap">
                {t('common.status', 'Statut')}
              </th>
              {dimensionCodes.map((code) => (
                <th
                  key={code}
                  className="px-3 py-4 text-xs font-bold text-[#454651] uppercase tracking-wider text-center whitespace-nowrap"
                >
                  {code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#c6c5d2]/10">
            {rows.map((row, idx) => {
              const { label, cls } = statusLabel(row.scoreGlobal)
              return (
                <tr
                  key={row.asnId}
                  className={`hover:bg-[#f0f4fd] transition-colors ${
                    idx % 2 === 1 ? 'bg-[#f0f4fd]/30' : ''
                  }`}
                >
                  <td className="px-6 py-4">
                    <div className="font-bold text-[#15236e]">{row.nom}</div>
                    {row.dernierAudit && (
                      <div className="text-[10px] text-[#454651] uppercase">
                        Dernier audit: {row.dernierAudit}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`font-headline font-bold ${globalScoreColor(row.scoreGlobal)}`}>
                      {row.scoreGlobal}%
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}
                    >
                      {label}
                    </span>
                  </td>
                  {dimensionCodes.map((code) => {
                    const dimScore = row.scoreParDimension[code] ?? 0
                    return (
                      <td key={code} className="px-3 py-4 text-center">
                        <span
                          className={`inline-block px-2 py-1 rounded-lg text-xs font-bold min-w-[40px] ${heatmapBg(
                            dimScore,
                          )}`}
                        >
                          {dimScore}%
                        </span>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
