import { useTranslation } from 'react-i18next'
import type { AuditAction } from '@/types'
import type { AuditFilters as AuditFiltersType } from '@/services/auditService'

interface AuditFiltersProps {
  filters: AuditFiltersType
  onChange: (filters: AuditFiltersType) => void
  onReset: () => void
}

const ACTIONS: Array<{ value: AuditAction; fr: string; en: string }> = [
  { value: 'create', fr: 'Créé', en: 'Created' },
  { value: 'update', fr: 'Modifié', en: 'Updated' },
  { value: 'delete', fr: 'Supprimé', en: 'Deleted' },
  { value: 'login', fr: 'Connexion', en: 'Login' },
  { value: 'logout', fr: 'Déconnexion', en: 'Logout' },
  { value: 'submit', fr: 'Soumis', en: 'Submitted' },
  { value: 'validate', fr: 'Validé', en: 'Validated' },
  { value: 'close', fr: 'Clôturé', en: 'Closed' },
]

const RESOURCES = ['evaluation', 'campagne', 'referentiel', 'planAction', 'utilisateur']

/**
 * Barre de filtres audit — type d'action, ressource, plage de dates.
 * Design Stitch : inputs recessed bg-white ring-1, labels uppercase xs.
 */
export function AuditFilters({ filters, onChange, onReset }: AuditFiltersProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'

  function handleAction(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value as AuditAction | ''
    onChange({ ...filters, action: value || undefined })
  }

  function handleResource(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value
    onChange({ ...filters, resource: value || undefined })
  }

  function handleDateFrom(e: React.ChangeEvent<HTMLInputElement>) {
    onChange({ ...filters, dateFrom: e.target.value ? new Date(e.target.value) : undefined })
  }

  function handleDateTo(e: React.ChangeEvent<HTMLInputElement>) {
    onChange({ ...filters, dateTo: e.target.value ? new Date(e.target.value) : undefined })
  }

  return (
    <div className="p-6 bg-[#f0f4fd] flex flex-wrap gap-4 items-end border-b border-[#c6c5d2]/10">
      {/* Type d'action */}
      <div className="flex-1 min-w-[180px]">
        <label className="text-[10px] font-bold uppercase tracking-widest text-[#454651] mb-1 block">
          {t('pages.audit.typeAction', "Type d'action")}
        </label>
        <select
          value={filters.action ?? ''}
          onChange={handleAction}
          className="w-full px-4 py-2 bg-white border-none rounded-lg text-sm ring-1 ring-[#c6c5d2]/30 focus:ring-2 focus:ring-[#15236e]/20 appearance-none"
        >
          <option value="">{t('pages.audit.toutesActions', 'Toutes les actions')}</option>
          {ACTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {lang === 'en' ? a.en : a.fr}
            </option>
          ))}
        </select>
      </div>

      {/* Ressource */}
      <div className="flex-1 min-w-[180px]">
        <label className="text-[10px] font-bold uppercase tracking-widest text-[#454651] mb-1 block">
          {t('pages.audit.ressource', 'Ressource')}
        </label>
        <select
          value={filters.resource ?? ''}
          onChange={handleResource}
          className="w-full px-4 py-2 bg-white border-none rounded-lg text-sm ring-1 ring-[#c6c5d2]/30 focus:ring-2 focus:ring-[#15236e]/20 appearance-none"
        >
          <option value="">{t('pages.audit.toutesRessources', 'Toutes les ressources')}</option>
          {RESOURCES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* Date de début */}
      <div className="flex-1 min-w-[160px]">
        <label className="text-[10px] font-bold uppercase tracking-widest text-[#454651] mb-1 block">
          {t('pages.audit.du', 'Du')}
        </label>
        <input
          type="date"
          value={filters.dateFrom ? filters.dateFrom.toISOString().slice(0, 10) : ''}
          onChange={handleDateFrom}
          className="w-full px-4 py-2 bg-white border-none rounded-lg text-sm ring-1 ring-[#c6c5d2]/30 focus:ring-2 focus:ring-[#15236e]/20"
        />
      </div>

      {/* Date de fin */}
      <div className="flex-1 min-w-[160px]">
        <label className="text-[10px] font-bold uppercase tracking-widest text-[#454651] mb-1 block">
          {t('pages.audit.au', 'Au')}
        </label>
        <input
          type="date"
          value={filters.dateTo ? filters.dateTo.toISOString().slice(0, 10) : ''}
          onChange={handleDateTo}
          className="w-full px-4 py-2 bg-white border-none rounded-lg text-sm ring-1 ring-[#c6c5d2]/30 focus:ring-2 focus:ring-[#15206e]/20"
        />
      </div>

      {/* Reset */}
      <div className="self-end">
        <button
          onClick={onReset}
          className="px-4 py-2 text-[#15236e] font-bold text-sm hover:underline"
        >
          {t('common.reset', 'Réinitialiser')}
        </button>
      </div>
    </div>
  )
}
