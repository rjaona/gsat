import { useState, useEffect, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { createUser, updateUserRole } from '@/services/adminService'
import type { UserProfile, UserRole, OrgType } from '@/types'
import { useAuthStore } from '@/stores/authStore'

// ── Props ─────────────────────────────────────────────────────────────────────

interface UserFormModalProps {
  user?: UserProfile | undefined   // undefined = création, défini = édition du rôle
  onClose: () => void
  onSaved: () => void
}

// ── Constantes ────────────────────────────────────────────────────────────────

const ROLES: UserRole[] = [
  'admin_global',
  'responsable_region',
  'responsable_osn',
  'utilisateur_asn',
  'evaluateur',
  'lecteur',
]

const ORG_TYPES: OrgType[] = ['OMMS', 'REGION', 'OSN', 'ASN']

// ── Shared styles ─────────────────────="────────────────────────────────────

const fieldCls = 'w-full bg-[#f0f4fd] border-none rounded-lg px-4 py-2.5 text-sm text-[#171c22] placeholder-[#767682] focus:ring-2 focus:ring-[#15236e]/20 focus:outline-none transition-all'
const labelCls = 'block text-[10px] font-bold uppercase tracking-widest text-[#454651] mb-1.5'

// ── Composant ─────────────────────────────────────────────────────────────────

export function UserFormModal({ user, onClose, onSaved }: UserFormModalProps) {
  const { t } = useTranslation()
  const isEdit = Boolean(user)
  const authUser = useAuthStore(s => s.user)
  const authProfile = useAuthStore(s => s.profile)

  // Champs création uniquement
  const [prenom, setPrenom] = useState(user?.prenom ?? '')
  const [nom, setNom] = useState(user?.nom ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [password, setPassword] = useState('')

  // Champs communs création + édition
  const [role, setRole] = useState<UserRole>(user?.role ?? 'utilisateur_asn')
  const [orgId, setOrgId] = useState(user?.orgId ?? '')
  const [orgType, setOrgType] = useState<OrgType>(user?.orgType ?? 'ASN')
  const [parentOrgId, setParentOrgId] = useState(user?.parentOrgId ?? '')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fermeture ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!orgId.trim()) {
      setError(t('admin.utilisateurs.form.selectionnerOrg'))
      return
    }

    setLoading(true)
    try {
      if (isEdit && user) {
        await updateUserRole(
          user.id,
          role,
          orgId.trim(),
          orgType,
          parentOrgId.trim() || undefined
        )
      } else {
        if (!prenom.trim() || !nom.trim()) {
          setError('Le prénom et le nom sont obligatoires.')
          setLoading(false)
          return
        }
        if (!email.trim() || !password) {
          setError("L'email et le mot de passe sont obligatoires.")
          setLoading(false)
          return
        }
        const adminId = authUser?.id
        const adminName = authProfile
          ? `${authProfile.prenom} ${authProfile.nom}`
          : (authUser?.email ?? undefined)
        await createUser(
          {
            email: email.trim(),
            password,
            displayName: `${prenom.trim()} ${nom.trim()}`,
            prenom: prenom.trim(),
            nom: nom.trim(),
            role,
            orgId: orgId.trim(),
            orgType,
            parentOrgId: parentOrgId.trim() || undefined,
          },
          adminId,
          adminName,
        )
      }
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-modal-title"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e4e8f1]">
          <h2 id="user-modal-title" className="text-base font-bold text-[#15236e] font-headline">
            {isEdit
              ? t('admin.utilisateurs.form.titreEdition')
              : t('admin.utilisateurs.form.titreCreation')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#767682] hover:bg-[#f0f4fd] transition-colors"
            aria-label={t('common.close')}
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Body */}
        <form id="user-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          {/* Champs création uniquement */}
          {!isEdit && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="user-prenom" className={labelCls}>
                    {t('admin.utilisateurs.form.prenom')} *
                  </label>
                  <input
                    id="user-prenom"
                    type="text"
                    value={prenom}
                    onChange={e => setPrenom(e.target.value)}
                    required
                    className={fieldCls}
                  />
                </div>
                <div>
                  <label htmlFor="user-nom" className={labelCls}>
                    {t('admin.utilisateurs.form.nom')} *
                  </label>
                  <input
                    id="user-nom"
                    type="text"
                    value={nom}
                    onChange={e => setNom(e.target.value)}
                    required
                    className={fieldCls}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="user-email" className={labelCls}>
                  {t('auth.email')} *
                </label>
                <input
                  id="user-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className={fieldCls}
                />
              </div>

              <div>
                <label htmlFor="user-password" className={labelCls}>
                  {t('auth.password')} *
                </label>
                <input
                  id="user-password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Min. 8 caractères"
                  className={fieldCls}
                />
              </div>

              <div className="border-t border-[#e4e8f1] pt-4" />
            </>
          )}

          {/* Rôle */}
          <div>
            <label htmlFor="user-role" className={labelCls}>
              {t('admin.utilisateurs.form.role')} *
            </label>
            <select
              id="user-role"
              value={role}
              onChange={e => setRole(e.target.value as UserRole)}
              required
              className={fieldCls}
            >
              {ROLES.map(r => (
                <option key={r} value={r}>{t(`admin.roles.${r}`)}</option>
              ))}
            </select>
          </div>

          {/* Organisation */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="user-orgtype" className={labelCls}>
                Type d'organisation *
              </label>
              <select
                id="user-orgtype"
                value={orgType}
                onChange={e => setOrgType(e.target.value as OrgType)}
                required
                className={fieldCls}
              >
                {ORG_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="user-orgid" className={labelCls}>
                {t('admin.utilisateurs.form.organisation')} *
              </label>
              <input
                id="user-orgid"
                type="text"
                value={orgId}
                onChange={e => setOrgId(e.target.value)}
                required
                placeholder={t('admin.utilisateurs.form.selectionnerOrg')}
                className={fieldCls}
              />
            </div>
          </div>

          {/* Organisation parente (optionnel, visible pour les rôles sub-org) */}
          {(role === 'utilisateur_asn' || role === 'evaluateur') && (
            <div>
              <label htmlFor="user-parent-orgid" className={labelCls}>
                Organisation parente (OSN)
              </label>
              <input
                id="user-parent-orgid"
                type="text"
                value={parentOrgId}
                onChange={e => setParentOrgId(e.target.value)}
                placeholder="ID de l'OSN parent (optionnel)"
                className={fieldCls}
              />
            </div>
          )}

          {/* Erreur */}
          {error && (
            <div className="p-3 bg-[#ffdad6] text-[#93000a] rounded-lg text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">error</span>
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#e4e8f1]">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-[#454651] hover:bg-[#f0f4fd] rounded-lg transition-colors disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            form="user-form"
            disabled={loading}
            className="px-6 py-2 text-sm font-bold text-white bg-gradient-to-r from-[#15236e] to-[#2e3b85] rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
          >
            {loading && (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {isEdit ? t('common.save') : t('admin.utilisateurs.nouvel')}
          </button>
        </div>
      </div>
    </div>
  )
}
