import { useTranslation } from 'react-i18next'
import { AuditActionBadge } from './AuditActionBadge'
import type { AuditEntry } from '@/types'

interface AuditTableProps {
  entries: AuditEntry[]
  loading?: boolean
  hasMore: boolean
  onLoadMore: () => void
  page: number
  onPageInfo?: (info: string) => void
}

function formatTimestamp(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' UTC',
  }
}

function initials(email: string): string {
  const parts = (email.split('@')[0] ?? '').split(/[._-]/)
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * Tableau paginé du journal d'audit.
 * Design Stitch : table sans bordures, divide-y, hover:bg-surface-container-low/50.
 */
export function AuditTable({ entries, loading, hasMore, onLoadMore, page }: AuditTableProps) {
  const { t } = useTranslation()

  if (loading && entries.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="material-symbols-outlined animate-spin text-[#15236e] text-3xl mr-3">
          progress_activity
        </span>
        <span className="text-[#454651]">{t('common.loading', 'Chargement…')}</span>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-16">
        <span className="material-symbols-outlined text-[#c6c5d2] text-4xl">history</span>
        <p className="text-[#454651] text-sm mt-3">
          {t('pages.audit.aucuneEntree', "Aucune entrée dans le journal d'audit.")}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#e4e8f1]">
            <tr>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#454651]">
                {t('common.date', 'Date')}
              </th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#454651]">
                {t('pages.audit.acteur', 'Acteur')}
              </th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#454651]">
                {t('common.actions', 'Action')}
              </th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#454651]">
                {t('pages.audit.ressource', 'Ressource')}
              </th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#454651] text-right">
                {t('pages.audit.reference', 'Référence')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eaeef7]">
            {entries.map((entry, idx) => {
              const { date, time } = formatTimestamp(entry.timestamp)
              return (
                <tr
                  key={entry.id}
                  className={`hover:bg-[#f0f4fd]/50 transition-colors group ${
                    idx % 2 === 1 ? 'bg-[#f0f4fd]/20' : ''
                  }`}
                >
                  <td className="px-6 py-5">
                    <div className="text-sm font-semibold text-[#171c22]">{date}</div>
                    <div className="text-[11px] text-[#767682]">{time}</div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-[#dee3eb] flex items-center justify-center text-xs font-bold text-[#15236e] flex-shrink-0">
                        {initials(entry.userEmail)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[#15236e]">{entry.userEmail}</div>
                        <div className="text-[11px] text-[#454651] uppercase tracking-wider">
                          {entry.userId}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <AuditActionBadge action={entry.action} />
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-sm font-medium text-[#171c22]">{entry.resource}</div>
                    <div className="text-[11px] text-[#767682]">{entry.resourceId}</div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    {entry.metadata && (
                      <button
                        className="text-[#c6c5d2] group-hover:text-[#15236e] transition-colors"
                        aria-label="Voir les détails"
                        title={JSON.stringify(entry.metadata, null, 2)}
                      >
                        <span className="material-symbols-outlined">open_in_new</span>
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pied pagination */}
      <div className="px-6 py-4 bg-[#f0f4fd] flex justify-between items-center">
        <p className="text-xs text-[#454651]">
          {t('pages.audit.pageInfo', { page, defaultValue: `Page ${page}` })}
          {hasMore && ' — ' + t('pages.audit.plusDeResultats', 'plus de résultats disponibles')}
        </p>
        {hasMore && (
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-[#c6c5d2]/30 text-[#15236e] rounded-lg text-xs font-bold hover:bg-[#dee0ff] transition-colors disabled:opacity-50"
          >
            {loading && (
              <span className="material-symbols-outlined animate-spin text-sm">
                progress_activity
              </span>
            )}
            {t('pages.audit.chargerPlus', 'Charger plus')}
          </button>
        )}
      </div>
    </>
  )
}
