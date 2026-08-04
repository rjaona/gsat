import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCampagneStore } from '@/stores/campagneStore'
import { useCampagneActions } from '@/hooks/useCampagne'
import type { Campagne, CampagneStatut } from '@/types'
import CampagneFormModal from '@/components/campagnes/CampagneFormModal'
import { CampagneStatutBadge } from '@/components/campagnes/CampagneStatutBadge'
import { isCampagneExpiree } from '@/services/campagneService'
// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function progressionCampagne(campagne: Campagne): number {
  if (campagne.statut === 'archivee' || campagne.statut === 'fermee') return 100
  if (campagne.statut === 'planifiee') return 0
  // Estimation basée sur la durée écoulée
  const now = Date.now()
  const ouv = new Date(campagne.dateOuverture).getTime()
  const fer = new Date(campagne.dateFermeture).getTime()
  if (fer <= ouv) return 100
  return Math.min(100, Math.round(((now - ouv) / (fer - ouv)) * 100))
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string | number
  icon: string
  accentClass: string
  iconBgClass: string
  iconColorClass: string
  sub?: string | undefined
}

function StatCard({ label, value, icon, accentClass, iconBgClass, iconColorClass, sub }: StatCardProps) {
  return (
    <div className={`bg-[#ffffff] p-6 rounded-xl border-l-4 ${accentClass} shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-[10px] uppercase font-bold tracking-widest text-[#454651] mb-1">{label}</p>
          <h3 className="text-3xl font-extrabold font-headline text-[#15236e]">{value}</h3>
        </div>
        <span className={`material-symbols-outlined ${iconColorClass} ${iconBgClass} p-3 rounded-full`}>
          {icon}
        </span>
      </div>
      {sub && (
        <div className="mt-4 flex items-center text-xs text-[#454651]">
          <span className="material-symbols-outlined text-sm mr-1">timer</span>
          <span>{sub}</span>
        </div>
      )}
    </div>
  )
}

// ── Row Actions Menu ──────────────────────────────────────────────────────────

interface RowMenuProps {
  campagne: Campagne
  onEdit: (c: Campagne) => void
  onStatut: (c: Campagne, statut: CampagneStatut) => void
  onDelete: (c: Campagne) => void
}

function RowMenu({ campagne, onEdit, onStatut, onDelete }: RowMenuProps) {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()

  const nextStatuts: Record<CampagneStatut, CampagneStatut[]> = {
    planifiee: ['ouverte'],
    ouverte: ['fermee'],
    fermee: ['archivee'],
    archivee: [],
  }

  const transitions = nextStatuts[campagne.statut] ?? []

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-[#454651] hover:text-[#15236e] transition-colors p-1 rounded"
      >
        <span className="material-symbols-outlined">more_vert</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-lg border border-[#c6c5d2]/30 min-w-[180px] py-1 overflow-hidden">
            <button
              onClick={() => { onEdit(campagne); setOpen(false) }}
              className="w-full text-left px-4 py-2.5 text-sm text-[#171c22] hover:bg-[#f0f4fd] flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px] text-[#15236e]">edit</span>
              {t('common.edit')}
            </button>

            {transitions.map(s => (
              <button
                key={s}
                onClick={() => { onStatut(campagne, s); setOpen(false) }}
                className="w-full text-left px-4 py-2.5 text-sm text-[#171c22] hover:bg-[#f0f4fd] flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[16px] text-[#3b6934]">arrow_forward</span>
                {t(`campagne.statuts.${s}`)}
              </button>
            ))}

            <div className="border-t border-[#c6c5d2]/30 my-1" />
            <button
              onClick={() => { onDelete(campagne); setOpen(false) }}
              className="w-full text-left px-4 py-2.5 text-sm text-[#ba1a1a] hover:bg-[#ffdad6]/30 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
              {t('common.delete')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

const STATUTS: CampagneStatut[] = ['planifiee', 'ouverte', 'fermee', 'archivee']
const PAGE_SIZE = 10

export function CyclesPage() {
  const { t } = useTranslation()
  const { campagnes, loading, error, subscribe } = useCampagneStore()
  const { changerStatut, supprimerCampagne } = useCampagneActions()

  const [filtreStatut, setFiltreStatut] = useState<CampagneStatut | 'tous'>('tous')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Campagne | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Campagne | null>(null)

  // Abonnement temps réel
  useEffect(() => {
    const unsub = subscribe()
    return unsub
  }, [subscribe])

  // Filtrage et recherche
  const filtered = campagnes.filter(c => {
    const matchStatut = filtreStatut === 'tous' || c.statut === filtreStatut
    const matchSearch = search === '' || c.nom.toLowerCase().includes(search.toLowerCase())
    return matchStatut && matchSearch
  })

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Stats
  const enCours = campagnes.filter(c => c.statut === 'ouverte').length
  const enAttente = campagnes.filter(c => c.statut === 'planifiee').length
  const expirees = campagnes.filter(c => c.statut === 'ouverte' && isCampagneExpiree(c)).length

  function handleEdit(c: Campagne) {
    setEditing(c)
    setShowForm(true)
  }

  function handleStatut(c: Campagne, statut: CampagneStatut) {
    changerStatut(c.id, statut)
  }

  async function handleDelete(c: Campagne) {
    await supprimerCampagne(c.id)
    setConfirmDelete(null)
  }

  return (
    <div>
      {/* ── En-tête ─────────────────────────────────────────────────────── */}
      <div className="mb-8 flex flex-wrap justify-between items-end gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-[#15236e] font-headline mb-2">
            {t('campagne.titre')}
          </h1>
          <p className="text-[#454651] text-lg">
            {t('admin.sousTitre')}
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="bg-gradient-to-r from-[#15236e] to-[#2e3b85] text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined">add_circle</span>
          <span>{t('campagne.nouvelle')}</span>
        </button>
      </div>

      {/* ── Stats bento ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          label={t('status.open')}
          value={enCours}
          icon="sync"
          accentClass="border-[#15236e]"
          iconBgClass="bg-[#dee0ff]"
          iconColorClass="text-[#2e3b85]"
        />
        <StatCard
          label={t('status.planned')}
          value={enAttente}
          icon="pending_actions"
          accentClass="border-[#ba1a1a]"
          iconBgClass="bg-[#ffdad6]"
          iconColorClass="text-[#ba1a1a]"
          sub={expirees > 0 ? `${expirees} expirée(s) sans clôture` : undefined}
        />
        <StatCard
          label={t('status.closed')}
          value={campagnes.filter(c => c.statut === 'fermee').length}
          icon="fact_check"
          accentClass="border-[#3b6934]"
          iconBgClass="bg-[#b9eeab]/40"
          iconColorClass="text-[#3b6934]"
        />
      </div>

      {/* ── Tableau ─────────────────────────────────────────────────────── */}
      <div className="bg-[#eaeef7] rounded-2xl p-1 overflow-hidden shadow-sm">
        <div className="bg-[#ffffff] rounded-[calc(1rem-0.25rem)] overflow-hidden">

          {/* Filtres */}
          <div className="p-6 flex flex-wrap gap-4 items-center border-b border-[#e4e8f1] bg-[#ffffff]">
            {/* Recherche */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#767682] text-lg">search</span>
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder={t('common.search')}
                className="bg-[#f0f4fd] border-none rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-[#15236e]/20 placeholder-[#767682] min-w-[220px]"
              />
            </div>

            <div className="h-8 w-px bg-[#dee3eb] mx-2" />

            <div className="flex items-center gap-2 text-[#454651]">
              <span className="material-symbols-outlined text-[18px]">filter_list</span>
              <span className="text-xs font-bold uppercase tracking-wider">{t('common.filter')}</span>
            </div>

            {/* Filtre statut */}
            <select
              value={filtreStatut}
              onChange={e => { setFiltreStatut(e.target.value as CampagneStatut | 'tous'); setPage(1) }}
              className="bg-[#f0f4fd] border-none rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#15236e]/10 py-2 px-4"
            >
              <option value="tous">{t('campagne.filtreToutes')}</option>
              {STATUTS.map(s => (
                <option key={s} value={s}>{t(`campagne.statuts.${s}`)}</option>
              ))}
            </select>

            <div className="ml-auto">
              <button
                onClick={() => { setSearch(''); setFiltreStatut('tous'); setPage(1) }}
                className="text-[#15236e] text-xs font-bold hover:underline"
              >
                {t('common.reset')}
              </button>
            </div>
          </div>

          {/* Erreur */}
          {error && (
            <div className="mx-6 mt-4 p-3 bg-[#ffdad6] text-[#93000a] rounded-lg text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              {error}
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#e4e8f1]">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#454651]">
                    {t('campagne.form.nom')}
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#454651]">
                    {t('common.status')}
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#454651]">
                    {t('common.progress')}
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#454651]">
                    {t('campagne.dateOuverture')}
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#454651]">
                    {t('campagne.dateFermeture')}
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#454651] text-right">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f4fd]">
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-[#454651] text-sm">
                      <span className="material-symbols-outlined animate-spin text-[24px] text-[#15236e]">progress_activity</span>
                    </td>
                  </tr>
                )}

                {!loading && paginated.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <span className="material-symbols-outlined text-[48px] text-[#dee3eb] block mb-3">event_repeat</span>
                      <p className="text-[#454651] font-medium">{t('campagne.aucune')}</p>
                    </td>
                  </tr>
                )}

                {paginated.map((c, idx) => {
                  const pct = progressionCampagne(c)
                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-[#f0f4fd] transition-colors group ${idx % 2 === 1 ? 'bg-[#f8f9ff]/30' : ''}`}
                    >
                      {/* Nom */}
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="font-bold text-[#171c22] text-sm">{c.nom}</span>
                          {c.description && (
                            <span className="text-xs text-[#454651] mt-0.5 line-clamp-1">{c.description}</span>
                          )}
                          {c.perimetre.length > 0 && (
                            <span className="text-xs text-[#767682] mt-0.5">
                              {t('campagne.perimetreN', { count: c.perimetre.length })}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Statut */}
                      <td className="px-6 py-5">
                        <CampagneStatutBadge statut={c.statut} />
                      </td>

                      {/* Progression */}
                      <td className="px-6 py-5 min-w-[180px]">
                        <div className="flex flex-col space-y-1.5">
                          <div className="flex justify-between text-[10px] font-bold">
                            <span className="text-[#15236e]">{pct}%</span>
                          </div>
                          <div className="w-full bg-[#dee3eb] rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-[#3b6934] h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Dates */}
                      <td className="px-6 py-5 text-sm text-[#454651]">
                        {formatDate(c.dateOuverture)}
                      </td>
                      <td className="px-6 py-5 text-sm text-[#454651]">
                        <span className={isCampagneExpiree(c) && c.statut === 'ouverte' ? 'text-[#ba1a1a] font-semibold' : ''}>
                          {formatDate(c.dateFermeture)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-5 text-right">
                        <RowMenu
                          campagne={c}
                          onEdit={handleEdit}
                          onStatut={handleStatut}
                          onDelete={setConfirmDelete}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 flex items-center justify-between bg-[#f0f4fd]/50">
            <span className="text-xs text-[#454651]">
              {t('admin.pagination.affichage', {
                debut: filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1,
                fin: Math.min(page * PAGE_SIZE, filtered.length),
                total: filtered.length,
              })}
            </span>
            <div className="flex space-x-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="p-2 rounded-lg border border-[#c6c5d2]/30 text-[#454651] hover:bg-white disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${p === page ? 'bg-[#15236e] text-white shadow-sm' : 'hover:bg-white text-[#454651]'}`}
                >
                  {p}
                </button>
              ))}
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                className="p-2 rounded-lg border border-[#c6c5d2]/30 text-[#454651] hover:bg-white disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Info panel ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        <div className="bg-[#15236e] p-8 rounded-2xl text-white relative overflow-hidden group shadow-xl">
          <div className="relative z-10">
            <h4 className="text-xl font-bold font-headline mb-4">Directives de conformité GSAT</h4>
            <p className="text-[#9ca9fb] text-sm leading-relaxed mb-6 opacity-90">
              Tous les nouveaux cycles doivent intégrer le référentiel WOSM V3.0. Assurez-vous que les questionnaires sont à jour avant l'ouverture.
            </p>
            <button className="inline-flex items-center gap-2 text-sm font-bold border-b-2 border-[#a1d494] pb-1 hover:text-[#a1d494] transition-colors">
              <span>Consulter le référentiel</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
          <div className="absolute -right-8 -bottom-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
            <span className="material-symbols-outlined" style={{ fontSize: 160 }}>article</span>
          </div>
        </div>

        <div className="bg-[#e4e8f1]/40 p-8 rounded-2xl flex flex-col justify-center border border-[#dee3eb]/50">
          <div className="flex items-start gap-4">
            <div className="bg-white p-3 rounded-xl shadow-sm shrink-0">
              <span className="material-symbols-outlined text-[#15236e]" style={{ fontVariationSettings: "'FILL' 1" }}>lightbulb</span>
            </div>
            <div>
              <h4 className="font-bold text-[#15236e] mb-1">Astuce administrateur</h4>
              <p className="text-xs text-[#454651] leading-relaxed">
                Utilisez la vue "Archivée" pour comparer les résultats des cycles précédents avec les moyennes historiques par ASN et identifier les tendances critiques.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal formulaire ────────────────────────────────────────────── */}
      {showForm && (
        <CampagneFormModal
          campagne={editing ?? undefined}
          onClose={() => { setShowForm(false); setEditing(null) }}
        />
      )}

      {/* ── Confirmation suppression ─────────────────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#ffdad6] flex items-center justify-center">
                <span className="material-symbols-outlined text-[#ba1a1a]">warning</span>
              </div>
              <h3 className="font-headline font-bold text-[#15236e]">{t('common.confirm')}</h3>
            </div>
            <p className="text-sm text-[#454651] mb-6">
              Supprimer la campagne <strong>« {confirmDelete.nom} »</strong> ? Cette action est irréversible.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm font-medium text-[#454651] hover:bg-[#f0f4fd] rounded-lg transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="px-4 py-2 text-sm font-bold text-white bg-[#ba1a1a] hover:opacity-90 rounded-lg transition-opacity"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
