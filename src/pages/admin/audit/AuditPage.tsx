import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { AuditTable } from '@/components/audit/AuditTable'
import { AuditFilters } from '@/components/audit/AuditFilters'
import { queryAuditLog } from '@/services/auditService'
import type { AuditEntry } from '@/types'
import type { AuditFilters as AuditFiltersType } from '@/services/auditService'

// ── CSV Export ────────────────────────────────────────────────────────────────

function entriesToCsv(entries: AuditEntry[]): string {
  const HEADERS = ['Date', 'Utilisateur ID', 'Email', 'Action', 'Ressource', 'ID Ressource', 'Metadata']
  const escape = (val: string) => `"${val.replace(/"/g, '""')}"`
  const rows = entries.map(e => [
    escape(new Date(e.timestamp).toISOString()),
    escape(e.userId),
    escape(e.userEmail),
    escape(e.action),
    escape(e.resource),
    escape(e.resourceId),
    escape(e.metadata ? JSON.stringify(e.metadata) : ''),
  ].join(','))
  return [HEADERS.join(','), ...rows].join('\r\n')
}

function downloadCsv(content: string, filename: string): void {
  const bom = '\uFEFF' // UTF-8 BOM pour Excel
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const EMPTY_FILTERS: AuditFiltersType = {}

// ── Page ─────────────────────────────────────────────────────────────────────

export function AuditPage() {
  const { t } = useTranslation()

  const [filters, setFilters] = useState<AuditFiltersType>(EMPTY_FILTERS)
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const [cursor, setCursor] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  const loadFirstPage = useCallback(
    async (newFilters: AuditFiltersType) => {
      setLoading(true)
      setError(null)
      setEntries([])
      setCursor(null)
      setPage(1)
      setInitialized(true)
      try {
        const result = await queryAuditLog(newFilters, null)
        setEntries(result.entries)
        setCursor(result.nextOffset)
        setHasMore(result.hasMore)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return
    setLoading(true)
    try {
      const result = await queryAuditLog(filters, cursor)
      setEntries((prev) => [...prev, ...result.entries])
      setCursor(result.nextOffset)
      setHasMore(result.hasMore)
      setPage((p) => p + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [hasMore, loading, filters, cursor])

  function handleFiltersChange(newFilters: AuditFiltersType) {
    setFilters(newFilters)
    void loadFirstPage(newFilters)
  }

  function handleReset() {
    setFilters(EMPTY_FILTERS)
    void loadFirstPage(EMPTY_FILTERS)
  }

  // Chargement initial au premier rendu
  useEffect(() => {
    if (!initialized && !loading) {
      loadFirstPage(EMPTY_FILTERS)
    }
  }, [initialized, loading, loadFirstPage])

  return (
    <div>
      {/* En-tête page */}
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-[#15236e] mb-2 font-headline">
            {t('pages.audit.title', "Journal d'Audit")}
          </h1>
          <p className="text-[#454651] max-w-xl">
            {t(
              'pages.audit.subtitle',
              'Historique chronologique complet de toutes les actions institutionnelles dans le système GSAT.',
            )}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              if (entries.length === 0) return
              const csv = entriesToCsv(entries)
              const date = new Date().toISOString().slice(0, 10)
              downloadCsv(csv, `audit-gsat-${date}.csv`)
            }}
            disabled={entries.length === 0}
            className="px-5 py-2.5 bg-[#dee3eb] text-[#171c22] font-semibold rounded-xl flex items-center gap-2 hover:bg-[#d6dae3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-lg">file_download</span>
            {t('pages.audit.exportCsv', 'Exporter CSV')}
          </button>
          <button
            onClick={() => loadFirstPage(filters)}
            className="px-5 py-2.5 bg-[#15236e] text-white font-semibold rounded-xl flex items-center gap-2 shadow-lg shadow-[#15236e]/20 hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-lg">refresh</span>
            {t('pages.audit.actualiser', 'Actualiser')}
          </button>
        </div>
      </div>

      {/* Message erreur */}
      {error && (
        <div className="mb-6 p-4 bg-[#ffdad6] text-[#93000a] rounded-xl text-sm flex items-center gap-2">
          <span className="material-symbols-outlined">warning</span>
          {error}
        </div>
      )}

      {/* Table avec filtres */}
      <div className="bg-[#ffffff] rounded-2xl overflow-hidden shadow-sm border border-[#c6c5d2]/5">
        {/* Filtres */}
        <AuditFilters
          filters={filters}
          onChange={handleFiltersChange}
          onReset={handleReset}
        />

        {/* Tableau */}
        <AuditTable
          entries={entries}
          loading={loading}
          hasMore={hasMore}
          onLoadMore={loadMore}
          page={page}
        />
      </div>
    </div>
  )
}
