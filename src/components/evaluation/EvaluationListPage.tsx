import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { listEvaluationsByOrg, createEvaluation } from '@/services/evaluationService';
import { listCampagnes } from '@/services/campagneService';
import { EvaluationWorkflowBadge } from './EvaluationWorkflowBadge';
import type { Evaluation, Campagne, EvaluationType } from '@/types';

// ── Couleur score sémantique ──────────────────────────────────────────────────
function scoreColor(score: number): string {
  if (score >= 75) return 'var(--score-excellent)';
  if (score >= 50) return 'var(--score-moyen)';
  if (score >= 25) return 'var(--score-faible)';
  return 'var(--score-critique)';
}

// ── Modal création évaluation ─────────────────────────────────────────────────
function CreateEvalModal({
  campagnes,
  onClose,
  onCreated,
}: {
  campagnes: Campagne[];
  onClose: () => void;
  onCreated: (evalId: string) => void;
}) {
  const { t } = useTranslation();
  const { user, orgId } = useAuthStore();
  const [campagneId, setCampagneId] = useState(campagnes[0]?.id ?? '');
  const [type, setType] = useState<EvaluationType>('auto');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ESC key close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || !user) return;
    setError(null);
    setSubmitting(true);
    try {
      const id = await createEvaluation({ campagneId, orgId, type }, user.id);
      onCreated(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.erreur'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(23,28,34,0.45)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden animate-fadeIn"
        style={{ background: 'var(--surface-container-lowest)', boxShadow: '0 24px 48px -8px rgba(23,28,34,0.18)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5" style={{ borderBottom: '1px solid rgba(198,197,210,0.25)' }}>
          <div>
            <h3 className="text-base font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--on-surface)' }}>
              {t('evaluation.nouveau')}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--on-surface-variant)' }}>GSAT V3.0 — 105 critères</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--on-surface-variant)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-container-high)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>

        {/* Body */}
        <form id="eval-create-form" onSubmit={handleSubmit} className="px-7 py-6 space-y-5">

          {/* Campagne */}
          <div>
            <label className="block mb-2 text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--on-surface-variant)' }}>
              {t('evaluation.campagne')} <span style={{ color: 'var(--error)' }}>*</span>
            </label>
            {campagnes.length === 0 ? (
              <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(255,218,214,0.5)', color: '#93000a' }}>
                Aucune campagne ouverte. Demandez à votre responsable d'en créer une.
              </div>
            ) : (
              <select
                value={campagneId}
                onChange={e => setCampagneId(e.target.value)}
                required
                className="w-full rounded-xl px-4 py-3 text-sm outline-none appearance-none"
                style={{ background: 'var(--surface-container-highest)', border: '2px solid transparent', color: 'var(--on-surface)' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'var(--surface-container-lowest)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'var(--surface-container-highest)'; }}
              >
                {campagnes.map(c => (
                  <option key={c.id} value={c.id}>{c.nom}</option>
                ))}
              </select>
            )}
          </div>

          {/* Type évaluation */}
          <div>
            <label className="block mb-3 text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--on-surface-variant)' }}>
              Type d'évaluation
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(['auto', 'accompagnee'] as EvaluationType[]).map(evalType => {
                const isActive = type === evalType;
                return (
                  <button
                    key={evalType}
                    type="button"
                    onClick={() => setType(evalType)}
                    className="rounded-xl p-4 text-left transition-all"
                    style={{
                      border: `2px solid ${isActive ? 'var(--primary)' : 'var(--surface-variant)'}`,
                      background: isActive ? 'rgba(21,35,110,0.05)' : 'transparent',
                    }}
                  >
                    <span className="text-sm font-bold block" style={{ color: isActive ? 'var(--primary)' : 'var(--on-surface)' }}>
                      {evalType === 'auto' ? t('dashboard.evalTypeAuto') : t('dashboard.evalTypeAccompagnee')}
                    </span>
                    <span className="text-xs mt-1 block" style={{ color: 'var(--on-surface-variant)' }}>
                      {evalType === 'auto' ? 'Réalisée en interne' : 'Avec un évaluateur externe'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(255,218,214,0.5)', color: '#93000a' }}>
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-7 py-5" style={{ borderTop: '1px solid rgba(198,197,210,0.25)' }}>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-bold text-sm transition-colors"
            style={{ background: 'var(--surface-container-highest)', color: 'var(--on-surface)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-container-high)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-container-highest)'}
          >
            {t('common.annuler')}
          </button>
          <button
            type="submit"
            form="eval-create-form"
            disabled={campagnes.length === 0 || submitting}
            className="px-6 py-2.5 rounded-xl font-bold text-sm transition-opacity disabled:opacity-50 flex items-center gap-2"
            style={{ background: 'var(--primary)', color: '#ffffff' }}
          >
            {submitting && (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            Démarrer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export function EvaluationListPage() {
  const navigate = useNavigate();
  const { orgId } = useAuthStore();

  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [campagnes, setCampagnes] = useState<Campagne[]>([]);
  const [campagnesMap, setCampagnesMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    // Charger toutes les campagnes (pas seulement ouvertes) pour résoudre les noms
    Promise.all([
      listEvaluationsByOrg(orgId),
      listCampagnes(),
    ]).then(([evals, allCamps]) => {
      setEvaluations(evals);
      // Campagnes ouvertes pour le modal de création
      setCampagnes(allCamps.filter(c => c.statut === 'ouverte'));
      // Map id → nom pour l'affichage dans la liste
      const map: Record<string, string> = {};
      for (const c of allCamps) {
        map[c.id] = c.nom;
      }
      setCampagnesMap(map);
    }).finally(() => setLoading(false));
  }, [orgId]);

  function handleCreated(evalId: string) {
    navigate(`/evaluation/${evalId}`);
  }

  // ── Skeleton ──
  if (loading) {
    return (
      <div className="pt-8 pb-12 px-8 max-w-4xl mx-auto space-y-4">
        <div className="h-10 w-56 rounded-xl animate-pulse" style={{ background: 'var(--surface-container-high)' }} />
        {[0, 1, 2].map(i => (
          <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: 'var(--surface-container-high)' }} />
        ))}
      </div>
    );
  }

  return (
    <div className="pt-8 pb-12 px-8 max-w-4xl mx-auto space-y-6 animate-fadeIn">

      {/* Page header */}
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-headline)', color: 'var(--primary)' }}>
            Évaluations
          </h1>
          <p className="mt-1" style={{ color: 'var(--on-surface-variant)' }}>Organisation : {orgId ?? '—'}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:opacity-90 transition-opacity"
          style={{ background: 'var(--primary)', color: '#ffffff' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
          Nouvelle évaluation
        </button>
      </div>

      {/* Bannière campagnes ouvertes */}
      {campagnes.length > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
          style={{ background: 'rgba(185,238,171,0.3)', color: 'var(--secondary)' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>schedule</span>
          <span className="font-semibold">
            {campagnes.length} campagne{campagnes.length > 1 ? 's' : ''} ouverte{campagnes.length > 1 ? 's' : ''} :
          </span>
          <span style={{ opacity: 0.8 }}>{campagnes.map(c => c.nom).join(', ')}</span>
        </div>
      )}

      {/* Liste évaluations */}
      {evaluations.length === 0 ? (
        <div className="rounded-2xl p-16 text-center" style={{ background: 'var(--surface-container-lowest)', boxShadow: '0 8px 24px -4px rgba(23,28,34,0.06)' }}>
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: 'var(--surface-container-low)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '36px', color: 'var(--outline)' }}>assignment</span>
          </div>
          <h3 className="text-base font-bold mb-2" style={{ fontFamily: 'var(--font-headline)', color: 'var(--on-surface)' }}>Aucune évaluation</h3>
          <p className="text-sm mb-6 max-w-xs mx-auto" style={{ color: 'var(--on-surface-variant)' }}>
            Démarrez votre première évaluation GSAT V3.0 pour mesurer la performance de votre organisation.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity inline-flex items-center gap-2"
            style={{ background: 'var(--primary)', color: '#ffffff' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            Démarrer une évaluation
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {evaluations.map(ev => {
            const updatedAt = ev.updatedAt
              ? new Date(ev.updatedAt as string).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
              : null;

            return (
              <button
                key={ev.id}
                type="button"
                onClick={() => navigate(`/evaluation/${ev.id}`)}
                className="w-full flex items-center gap-4 p-5 rounded-xl text-left transition-all"
                style={{ background: 'var(--surface-container-lowest)', boxShadow: '0 8px 24px -4px rgba(23,28,34,0.06)', border: '1px solid rgba(198,197,210,0.15)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 32px -4px rgba(23,28,34,0.1)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px -4px rgba(23,28,34,0.06)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
              >
                {/* Score circle */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold tabular-nums flex-shrink-0"
                  style={{
                    background: ev.scoreGlobal != null ? `${scoreColor(ev.scoreGlobal)}18` : 'var(--surface-container)',
                    color: ev.scoreGlobal != null ? scoreColor(ev.scoreGlobal) : 'var(--outline)',
                    border: `2px solid ${ev.scoreGlobal != null ? scoreColor(ev.scoreGlobal) : 'var(--outline-variant)'}`,
                  }}
                >
                  {ev.scoreGlobal != null ? `${ev.scoreGlobal}%` : '—'}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold truncate" style={{ color: 'var(--on-surface)' }}>
                      {campagnesMap[ev.campagneId] ?? ev.campagneId}
                    </span>
                    <EvaluationWorkflowBadge statut={ev.statut} />
                    {/* Badge type */}
                    <span
                      className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                      style={ev.type === 'auto'
                        ? { background: 'rgba(21,35,110,0.1)', color: 'var(--primary)' }
                        : { background: 'var(--tertiary-fixed)', color: 'var(--on-tertiary-fixed)' }}
                    >
                      {ev.type === 'auto' ? 'Auto' : 'Accompagnée'}
                    </span>
                  </div>
                  {updatedAt && (
                    <p className="text-xs mt-1" style={{ color: 'var(--on-surface-variant)' }}>
                      Modifié le {updatedAt}
                    </p>
                  )}
                </div>

                <span className="material-symbols-outlined" style={{ color: 'var(--outline)' }}>chevron_right</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Modal création */}
      {showCreate && (
        <CreateEvalModal
          campagnes={campagnes}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
