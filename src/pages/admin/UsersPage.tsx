import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { listUsers, deleteUser } from '@/services/adminService'
import { UserFormModal } from '@/components/admin/UserFormModal'
import { useAuthStore } from '@/stores/authStore'
import type { UserProfile, UserRole } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function initiales(p: UserProfile): string {
  return `${(p.prenom ?? '').charAt(0)}${(p.nom ?? '').charAt(0)}`.toUpperCase()
}

const AVATAR_BG: Record<number, string> = {
  0: 'bg-[#dee0ff] text-[#15236e]',
  1: 'bg-[#b9eeab] text-[#23501e]',
  2: 'bg-[#e2e2e7] text-[#45474b]',
  3: 'bg-[#2e3b85] text-white',
}

function avatarColor(idx: number): string {
  return AVATAR_BG[idx % 4] ?? 'bg-[#dee0ff] text-[#15236e]'
}

// ── Badge statut ──────────────────────────────────────────────────────────────

function StatutBadge({ actif }: { actif: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-2">
      <div className={`w-1.5 h-1.5 rounded-full ${actif ? 'bg-[#3b6934]' : 'bg-[#c6c5d2]'}`} />
      <span className={`text-xs font-semibold ${actif ? 'text-[#3b6934]' : 'text-[#767682]'}`}>
        {actif ? t('admin.utilisateurs.actif') : t('admin.utilisateurs.inactif')}
      </span>
    </div>
  )
}

// ── Badge rôle ────────────────────────────────────────────────────────────────

const ROLE_STYLE: Partial<Record<UserRole, string>> = {
  admin_global:       'bg-indigo-50 text-[#15236e] border border-[#15236e]/10',
  responsable_region: 'bg-amber-50 text-amber-700 border border-amber-200',
  responsable_osn:    'bg-[#b9eeab]/40 text-[#23501e] border border-[#3b6934]/10',
  utilisateur_asn:    'bg-[#dee3eb] text-[#454651]',
  evaluateur:         'bg-[#dee0ff] text-[#33408a]',
  lecteur:            'bg-[#f0f4fd] text-[#767682]',
}

function RoleBadge({ role }: { role: UserRole }) {
  const { t } = useTranslation()
  const style = ROLE_STYLE[role] ?? 'bg-[#dee3eb] text-[#454651]'
  return (
    <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${style}`}>
      {t(`admin.roles.${role}`)}
    </span>
  )
}

// ── Row menu ──────────────────────────────────────────────────────────────────

interface RowMenuProps {
  user: UserProfile
  isSelf: boolean
  onEdit: (u: UserProfile) => void
  onDelete: (u: UserProfile) => void
}

function RowMenu({ user, isSelf, onEdit, onDelete }: RowMenuProps) {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-[#767682] hover:text-[#15236e] transition-colors"
      >
        <span className="material-symbols-outlined">more_vert</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-lg border border-[#c6c5d2]/30 min-w-[160px] py-1 overflow-hidden">
            <button
              onClick={() => { onEdit(user); setOpen(false) }}
              className="w-full text-left px-4 py-2.5 text-sm text-[#171c22] hover:bg-[#f0f4fd] flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px] text-[#15236e]">edit</span>
              {t('common.edit')}
            </button>
            {isSelf ? (
              <>
                <div className="border-t border-[#c6c5d2]/30 my-1" />
                <div className="px-4 py-2.5 text-xs text-[#767682] flex items-center gap-2 select-none">
                  <span className="material-symbols-outlined text-[16px]">block</span>
                  {t('admin.utilisateurs.suppressionSelfInterdite')}
                </div>
              </>
            ) : (
              <>
                <div className="border-t border-[#c6c5d2]/30 my-1" />
                <button
                  onClick={() => { onDelete(user); setOpen(false) }}
                  className="w-full text-left px-4 py-2.5 text-sm text-[#ba1a1a] hover:bg-[#ffdad6]/30 flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                  {t('common.delete')}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

const ROLES: UserRole[] = [
  'admin_global',
  'responsable_region',
  'responsable_osn',
  'utilisateur_asn',
  'evaluateur',
  'lecteur',
]

const PAGE_SIZE = 10

export function UsersPage() {
  const { t } = useTranslation()
  const authUser = useAuthStore(s => s.user)
  const callerRole = useAuthStore(s => s.role)
  const callerOrgId = useAuthStore(s => s.orgId)

  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [filtreRole, setFiltreRole] = useState<UserRole | 'tous'>('tous')
  const [page, setPage] = useState(1)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<UserProfile | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<UserProfile | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Chargement initial
  async function charger() {
    setLoading(true)
    setError(null)
    try {
      const data = await listUsers(callerRole, callerOrgId)
      setUsers(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    charger()
  }, [])

  // Filtrage
  const filtered = users.filter(u => {
    const matchRole = filtreRole === 'tous' || u.role === filtreRole
    const q = search.toLowerCase()
    const matchSearch =
      q === '' ||
      u.nom.toLowerCase().includes(q) ||
      u.prenom.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    return matchRole && matchSearch
  })

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Stats
  const nbActifs = users.filter(u => u.actif).length
  const nbAdmins = users.filter(u => u.role === 'admin_global' || u.role === 'responsable_region').length
  const nbInactifs = users.filter(u => !u.actif).length

  async function handleDelete(u: UserProfile) {
    setDeleting(true)
    try {
      await deleteUser(u.id)
      setUsers(prev => prev.filter(x => x.id !== u.id))
      setConfirmDelete(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setDeleting(false)
    }
  }

  function handleSaved() {
    setShowForm(false)
    setEditing(null)
    charger()
  }

  return (
    <div>
      {/* ── En-tête ─────────────────────────────────────────────────────── */}
      <div className="mb-10 flex flex-wrap justify-between items-end gap-6">
        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#454651]/70 block">
            Governance Control
          </span>
          <h1 className="text-4xl font-extrabold font-headline tracking-tight text-[#15236e]">
            {t('admin.utilisateurs.titre')}
          </h1>
          <p className="text-[#454651] max-w-xl">
            {t('admin.sousTitre')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setFiltreRole('tous')}
            className="px-5 py-2.5 bg-[#dee3eb] text-[#171c22] text-sm font-semibold rounded-lg hover:bg-[#e4e8f1] transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">filter_list</span>
            {t('common.filter')}
          </button>
          <button
            onClick={() => { setEditing(null); setShowForm(true) }}
            className="px-6 py-2.5 bg-gradient-to-r from-[#15236e] to-[#2e3b85] text-white text-sm font-semibold rounded-lg hover:shadow-lg hover:shadow-[#15236e]/20 transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">person_add</span>
            {t('admin.utilisateurs.nouvel')}
          </button>
        </div>
      </div>

      {/* ── Stats bento ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
        <div className="bg-[#ffffff] p-6 rounded-xl shadow-sm border border-[#c6c5d2]/10">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">
            {t('admin.utilisateurs.utilisateur_s', { count: users.length })}
          </p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-black font-headline text-[#15236e]">{users.length}</h3>
          </div>
        </div>
        <div className="bg-[#ffffff] p-6 rounded-xl shadow-sm border border-[#c6c5d2]/10">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">
            {t('admin.utilisateurs.actif')}
          </p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-black font-headline text-[#15236e]">{nbActifs}</h3>
            <div className="w-2 h-2 rounded-full bg-[#3b6934] animate-pulse" />
          </div>
        </div>
        <div className="bg-[#ffffff] p-6 rounded-xl shadow-sm border border-[#c6c5d2]/10">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">
            Admin Roles
          </p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-black font-headline text-[#15236e]">{nbAdmins}</h3>
            <span className="text-xs text-slate-400">Global Level</span>
          </div>
        </div>
        <div className="bg-[#ffffff] p-6 rounded-xl shadow-sm border border-[#c6c5d2]/10">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">
            {t('admin.utilisateurs.inactif')}
          </p>
          <div className="flex items-baseline gap-2">
            <h3 className={`text-2xl font-black font-headline ${nbInactifs > 0 ? 'text-[#ba1a1a]' : 'text-[#15236e]'}`}>
              {nbInactifs}
            </h3>
            {nbInactifs > 0 && (
              <span className="text-xs text-[#ba1a1a] font-bold">Urgent</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Filtres de recherche ────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap gap-3 items-center">
        {/* Recherche */}
        <div className="relative flex-1 min-w-[240px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder={t('admin.utilisateurs.rechercher')}
            className="w-full pl-10 pr-4 py-2 bg-[#f0f4fd] border-none rounded-full text-sm focus:ring-2 focus:ring-[#15236e]/20 transition-all"
          />
        </div>

        {/* Filtre rôle */}
        <select
          value={filtreRole}
          onChange={e => { setFiltreRole(e.target.value as UserRole | 'tous'); setPage(1) }}
          className="bg-[#f0f4fd] border-none rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#15236e]/10 py-2 px-4"
        >
          <option value="tous">{t('admin.utilisateurs.tousLesRoles')}</option>
          {ROLES.map(r => (
            <option key={r} value={r}>{t(`admin.roles.${r}`)}</option>
          ))}
        </select>

        {(search || filtreRole !== 'tous') && (
          <button
            onClick={() => { setSearch(''); setFiltreRole('tous'); setPage(1) }}
            className="text-[#15236e] text-xs font-bold hover:underline"
          >
            {t('common.reset')}
          </button>
        )}
      </div>

      {/* Erreur */}
      {error && (
        <div className="mb-4 p-3 bg-[#ffdad6] text-[#93000a] rounded-lg text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          {error}
        </div>
      )}

      {/* ── Tableau ─────────────────────────────────────────────────────── */}
      <div className="bg-[#ffffff] rounded-2xl shadow-sm overflow-hidden border border-[#c6c5d2]/10">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#e4e8f1]">
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-[#454651]">
                  {t('admin.utilisateurs.colonne.nom')}
                </th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-[#454651]">
                  {t('admin.utilisateurs.colonne.role')}
                </th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-[#454651]">
                  {t('admin.utilisateurs.colonne.organisation')}
                </th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-[#454651]">
                  {t('admin.utilisateurs.colonne.statut')}
                </th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-[#454651] text-right">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <span className="material-symbols-outlined animate-spin text-[24px] text-[#15236e]">progress_activity</span>
                  </td>
                </tr>
              )}

              {!loading && paginated.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <span className="material-symbols-outlined text-[48px] text-[#dee3eb] block mb-3">manage_accounts</span>
                    <p className="font-medium text-[#454651]">{t('admin.utilisateurs.aucun')}</p>
                    <p className="text-sm text-[#767682] mt-1">{t('admin.utilisateurs.aucunDescription')}</p>
                  </td>
                </tr>
              )}

              {paginated.map((u, idx) => (
                <tr
                  key={u.id}
                  className={`hover:bg-[#f8f9ff] transition-colors ${idx % 2 === 1 ? 'bg-[#f0f4fd]/30' : ''}`}
                >
                  {/* Identité */}
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${avatarColor(idx)}`}>
                        {initiales(u)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#171c22]">{u.prenom} {u.nom}</p>
                        <p className="text-[11px] text-slate-500">{u.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Rôle */}
                  <td className="px-6 py-5">
                    <RoleBadge role={u.role} />
                  </td>

                  {/* Organisation */}
                  <td className="px-6 py-5">
                    <div className="flex items-center text-sm text-[#454651] font-medium gap-2">
                      <span className="material-symbols-outlined text-base text-slate-400">
                        {u.orgType === 'OMMS' ? 'language' : u.orgType === 'OSN' ? 'public' : 'flag'}
                      </span>
                      <span>{u.orgId}</span>
                    </div>
                  </td>

                  {/* Statut */}
                  <td className="px-6 py-5">
                    <StatutBadge actif={u.actif} />
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-5 text-right">
                    <RowMenu
                      user={u}
                      isSelf={u.id === authUser?.id}
                      onEdit={u => { setEditing(u); setShowForm(true) }}
                      onDelete={setConfirmDelete}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 bg-[#e4e8f1] flex items-center justify-between">
          <p className="text-xs text-[#454651]">
            {t('admin.pagination.affichage', {
              debut: filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1,
              fin: Math.min(page * PAGE_SIZE, filtered.length),
              total: filtered.length,
            })}
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="p-1 text-slate-400 hover:text-[#15236e] transition-colors disabled:opacity-30"
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-8 h-8 rounded text-xs font-bold transition-colors ${p === page ? 'bg-[#15236e] text-white' : 'text-slate-600 hover:bg-slate-200'}`}
              >
                {p}
              </button>
            ))}
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="p-1 text-slate-400 hover:text-[#15236e] transition-colors disabled:opacity-30"
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Panneau contextuel ──────────────────────────────────────────── */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8 items-center border-t border-[#c6c5d2]/10 pt-8">
        <div className="bg-[#2e3b85] rounded-2xl p-8 text-white relative overflow-hidden">
          <div className="relative z-10">
            <h4 className="text-white font-headline font-bold text-lg mb-2">Access Hierarchy Guide</h4>
            <p className="text-[#9ca9fb] text-xs mt-1">
              Understand the permission levels between OSN Leads and ASN regional users.
            </p>
          </div>
          <div className="absolute -right-6 -bottom-6 opacity-10">
            <span className="material-symbols-outlined" style={{ fontSize: 120 }}>admin_panel_settings</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-[#b9eeab]/30 rounded-lg shrink-0">
              <span className="material-symbols-outlined text-[#3b6934]">security</span>
            </div>
            <div>
              <p className="text-sm font-bold text-[#15236e]">Secure provisioning enabled</p>
              <p className="text-xs text-[#454651]">
                All new user accounts undergo a 2-step verification by the Global Security Team.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-[#dee0ff]/50 rounded-lg shrink-0">
              <span className="material-symbols-outlined text-[#15236e]">sync</span>
            </div>
            <div>
              <p className="text-sm font-bold text-[#15236e]">Supabase Auth Sync</p>
              <p className="text-xs text-[#454651]">
                Roles are propagated as custom JWT claims via the manage-user Edge Function and updated in real-time.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal formulaire ────────────────────────────────────────────── */}
      {showForm && (
        <UserFormModal
          user={editing ?? undefined}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={handleSaved}
        />
      )}

      {/* ── Confirmation suppression ─────────────────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#ffdad6] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[#ba1a1a]">warning</span>
              </div>
              <h3 className="font-headline font-bold text-[#15236e]">{t('common.confirm')}</h3>
            </div>
            <p className="text-sm text-[#454651] mb-6">
              {t('admin.utilisateurs.confirmerSuppression', {
                nom: `${confirmDelete.prenom} ${confirmDelete.nom}`,
              })}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-[#454651] hover:bg-[#f0f4fd] rounded-lg transition-colors disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-bold text-white bg-[#ba1a1a] hover:opacity-90 rounded-lg transition-opacity disabled:opacity-50"
              >
                {deleting ? '…' : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
