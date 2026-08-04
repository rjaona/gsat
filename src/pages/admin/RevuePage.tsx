import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import { listEvaluationsARevoir, revoirEvaluation } from '@/services/evaluationService'
import { getDashboardStats } from '@/services/dashboardService'
import { listAlertesOuvertes } from '@/services/alerteService'
import { getOrganisation } from '@/services/organisationService'
import { trierParRisque, compterEcheancesProches, type EvalRevue, type SignauxOrg } from '@/utils/revueRisque'

const SEUIL_ECHEANCE = 7

function RisqueBadge({ icon, value, danger }: { icon: string; value: string | number; danger?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: danger ? 'var(--danger-light)' : 'var(--surface-container-highest)', color: danger ? 'var(--danger)' : 'var(--text-secondary)' }}
    >
      <span className="material-symbols-outlined text-[14px]">{icon}</span>
      {value}
    </span>
  )
}

export function RevuePage() {
  const { t } = useTranslation()
  const { user, role } = useAuthStore()

  const [file, setFile] = useState<EvalRevue[]>([])
  const [orgNames, setOrgNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState<string | null>(null)
  const [revisionFor, setRevisionFor] = useState<EvalRevue | null>(null)
  const [motif, setMotif] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const evals = await listEvaluationsARevoir()
      const orgIds = [...new Set(evals.map(e => e.orgId))]
      const signaux: Record<string, SignauxOrg> = {}
      const names: Record<string, string> = {}
      await Promise.all(orgIds.map(async (oid) => {
        const [stats, alertes, org] = await Promise.all([
          getDashboardStats(oid).catch(() => null),
          listAlertesOuvertes(oid).catch(() => []),
          getOrganisation(oid).catch(() => null),
        ])
        signaux[oid] = {
          nbEssentielsKO: stats?.criteresEssentielsKO.length ?? 0,
          nbAlertesCritiques: alertes.filter(a => a.severite === 'critique').length,
        }
        if (org) names[oid] = org.nom
      }))
      setFile(trierParRisque(evals, signaux, new Date()))
      setOrgNames(names)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const approuver = useCallback(async (r: EvalRevue) => {
    if (!user || role == null) return
    setProcessing(r.evaluation.id)
    setError(null)
    try {
      await revoirEvaluation(r.evaluation.id, { verdict: 'approved', revuePar: user.id, role })
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setProcessing(null)
    }
  }, [user, role, load])

  const demanderRevision = useCallback(async () => {
    if (!user || role == null || !revisionFor) return
    if (!motif.trim()) { setError(t('revue.motifRequis')); return }
    setProcessing(revisionFor.evaluation.id)
    setError(null)
    try {
      await revoirEvaluation(revisionFor.evaluation.id, {
        verdict: 'revision_requested', motif: motif.trim(), revuePar: user.id, role,
      })
      setRevisionFor(null)
      setMotif('')
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setProcessing(null)
    }
  }, [user, role, revisionFor, motif, t, load])

  const nProches = compterEcheancesProches(file, SEUIL_ECHEANCE)

  return (
    <div className="p-8 space-y-6 max-w-[1200px] mx-auto w-full">
      <header>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight font-headline" style={{ color: 'var(--primary)' }}>
          {t('revue.title')}
        </h1>
        <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>{t('revue.subtitle')}</p>
      </header>

      {/* Bandeau clôture auto */}
      {nProches > 0 && (
        <div className="p-4 rounded-xl flex items-center gap-3" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}>
          <span className="material-symbols-outlined">timer</span>
          <span className="text-sm font-semibold">
            {t('revue.clotureAuto', { count: nProches, jours: SEUIL_ECHEANCE })}
          </span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg text-sm" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>{error}</div>
      )}

      {loading ? (
        <div className="py-16 text-center" style={{ color: 'var(--text-muted)' }}>
          <span className="material-symbols-outlined animate-spin text-[28px]">progress_activity</span>
        </div>
      ) : file.length === 0 ? (
        <div className="py-16 text-center" style={{ color: 'var(--text-muted)' }}>
          <span className="material-symbols-outlined text-[48px] block mb-2" style={{ color: 'var(--border)' }}>task_alt</span>
          {t('revue.aucune')}
        </div>
      ) : (
        <ul className="space-y-3">
          {file.map(r => {
            const s = r.evaluation
            const busy = processing === s.id
            const jours = r.joursAvantEcheance
            return (
              <li key={s.id} className="p-4 rounded-xl flex flex-col md:flex-row md:items-center gap-4" style={{ background: 'var(--surface-container-lowest)', boxShadow: 'var(--shadow-card)' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm" style={{ color: 'var(--text)' }}>{orgNames[s.orgId] ?? s.orgId}</span>
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                      {t('revue.risque')} {r.risque}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-2">
                    <RisqueBadge icon="grade" value={`${Math.round(s.scoreGlobal ?? 0)}/100`} />
                    {jours !== null && (
                      <RisqueBadge icon="event" value={t('revue.jours', { count: jours })} danger={jours <= SEUIL_ECHEANCE} />
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setRevisionFor(r)}
                    disabled={busy}
                    className="px-4 py-2 rounded-lg text-sm font-semibold border disabled:opacity-50"
                    style={{ background: 'transparent', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                  >
                    {t('revue.demanderRevision')}
                  </button>
                  <button
                    type="button"
                    onClick={() => approuver(r)}
                    disabled={busy}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: 'var(--success)' }}
                  >
                    {busy ? '…' : t('revue.approuver')}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Modal motif de révision */}
      {revisionFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={e => { if (e.target === e.currentTarget) setRevisionFor(null) }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: 'var(--surface)' }}>
            <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text)' }}>{t('revue.motifTitre')}</h2>
            <textarea
              rows={4}
              value={motif}
              onChange={e => setMotif(e.target.value)}
              placeholder={t('revue.motifPlaceholder')}
              className="w-full rounded-lg p-3 text-sm"
              style={{ background: 'var(--surface-container-highest)', color: 'var(--text)', border: '2px solid transparent' }}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button type="button" onClick={() => { setRevisionFor(null); setMotif('') }} className="px-4 py-2 text-sm font-medium rounded-lg" style={{ color: 'var(--text-secondary)' }}>
                {t('common.annuler')}
              </button>
              <button type="button" onClick={demanderRevision} disabled={!motif.trim()} className="px-4 py-2 text-sm font-bold text-white rounded-lg disabled:opacity-50" style={{ background: 'var(--danger)' }}>
                {t('revue.confirmerRevision')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
