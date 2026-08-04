/**
 * WorkflowPage — List of workflow cycles with navigation to detail view.
 *
 * Displays active campaigns as workflow cycles with stepper preview,
 * status badges, and navigation to WorkflowDetailPage.
 *
 * Connected to Supabase via useCampagneStore.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCampagneStore } from '@/stores/campagneStore';
import { listEvaluationsByCampagne } from '@/services/evaluationService';
import type { Campagne, CampagneStatut } from '@/types';
import type { WorkflowStep } from '@/types/workflow';

// ── Icon helper ──────────────────────────────────────────────────────────────

function MIcon({ name, size = 20, fill = 0 }: { name: string; size?: number | undefined; fill?: 0 | 1 | undefined }) {
  return (
    <span
      className="material-symbols-outlined"
      style={{
        fontSize: size,
        lineHeight: 1,
        fontVariationSettings: `'FILL' ${fill ?? 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
      }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

// ── Step definitions ─────────────────────────────────────────────────────────

const STEP_ORDER: WorkflowStep[] = [
  'initiation',
  'evaluation',
  'review',
  'approbation',
  'finalisation',
];

// ── Map campaign statut to workflow step ──────────────────────────────────────

function statutToStep(statut: CampagneStatut): WorkflowStep {
  switch (statut) {
    case 'planifiee': return 'initiation';
    case 'ouverte': return 'evaluation';
    case 'fermee': return 'approbation';
    case 'archivee': return 'finalisation';
    default: return 'initiation';
  }
}

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ── Derived cycle type ───────────────────────────────────────────────────────

interface CycleView {
  id: string;
  name: string;
  osn: string;
  currentStep: WorkflowStep;
  score: number;
  submittedBy: string;
  submittedAt: string;
}

// ── Mini stepper (inline preview) ────────────────────────────────────────────

function MiniStepper({ currentStep }: { currentStep: WorkflowStep }) {
  const { t } = useTranslation();
  const activeIndex = STEP_ORDER.indexOf(currentStep);

  return (
    <div className="flex items-center gap-1">
      {STEP_ORDER.map((step, i) => {
        const done = i < activeIndex;
        const current = i === activeIndex;
        return (
          <div key={step} className="flex items-center gap-1">
            <div
              className="w-6 h-6 flex items-center justify-center text-[10px] font-bold"
              style={{
                borderRadius: '50%',
                background: done || current ? 'var(--secondary)' : 'var(--surface-container-highest)',
                color: done || current ? 'white' : 'var(--outline)',
                boxShadow: current ? '0 0 0 2px rgba(59,105,52,0.25)' : 'none',
              }}
              title={t(`workflow.steps.${step}`)}
            >
              {done ? <MIcon name="check" size={12} fill={1} /> : i + 1}
            </div>
            {i < STEP_ORDER.length - 1 && (
              <div
                className="w-4 h-0.5"
                style={{
                  background: done ? 'var(--secondary)' : 'var(--surface-container-highest)',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function WorkflowPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { campagnes, loading, error, subscribe } = useCampagneStore();
  // Map campagneId → score moyen calculé depuis les évaluations
  const [scoresByCampagne, setScoresByCampagne] = useState<Record<string, number>>({});

  useEffect(() => {
    const unsubscribe = subscribe();
    return unsubscribe;
  }, [subscribe]);

  // Charger le score moyen de chaque campagne dès que la liste change
  useEffect(() => {
    if (campagnes.length === 0) return;
    let cancelled = false;

    Promise.all(
      campagnes.map(async (c: Campagne) => {
        const evals = await listEvaluationsByCampagne(c.id);
        const scored = evals.filter((e) => e.scoreGlobal != null);
        const avg = scored.length > 0
          ? Math.round(scored.reduce((sum, e) => sum + (e.scoreGlobal ?? 0), 0) / scored.length)
          : 0;
        return { id: c.id, avg };
      })
    ).then((results) => {
      if (cancelled) return;
      const map: Record<string, number> = {};
      for (const r of results) map[r.id] = r.avg;
      setScoresByCampagne(map);
    }).catch(() => {
      // Scores non critiques — échec silencieux
    });

    return () => { cancelled = true; };
  }, [campagnes]);

  // Map campagnes to cycle views
  const cycles: CycleView[] = useMemo(
    () =>
      campagnes.map((c: Campagne) => ({
        id: c.id,
        name: c.nom,
        osn: c.organisateurId,
        currentStep: statutToStep(c.statut),
        score: scoresByCampagne[c.id] ?? 0,
        submittedBy: c.createdBy,
        submittedAt: formatTimestamp(c.dateOuverture),
      })),
    [campagnes, scoresByCampagne],
  );

  return (
    <div className="p-8 space-y-8 max-w-[1400px] mx-auto w-full">

      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <nav
            className="flex items-center gap-2 text-xs mb-2"
            style={{ color: 'var(--on-surface-variant)' }}
            aria-label="Breadcrumb"
          >
            <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
              {t('workflow.title')}
            </span>
          </nav>
          <h2
            className="text-4xl font-extrabold tracking-tight"
            style={{ color: 'var(--primary)', fontFamily: 'var(--font-headline)' }}
          >
            {t('workflow.title')}
          </h2>
          <p
            className="text-sm mt-1"
            style={{ color: 'var(--on-surface-variant)' }}
          >
            {t('workflow.cyclesEnCours')}
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          className="p-4 rounded-xl text-sm flex items-center gap-2"
          style={{ background: 'var(--error-container)', color: 'var(--on-error-container)' }}
        >
          <MIcon name="warning" size={18} />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && cycles.length === 0 ? (
        <div
          className="p-12 text-center"
          style={{
            background: 'var(--surface-container-lowest)',
            boxShadow: 'var(--shadow-card)',
            borderRadius: 'var(--radius-xl)',
            color: 'var(--outline)',
          }}
        >
          <MIcon name="sync" size={48} />
          <p className="mt-4 text-sm">{t('common.loading', 'Loading...')}</p>
        </div>
      ) : cycles.length === 0 ? (
        <div
          className="p-12 text-center"
          style={{
            background: 'var(--surface-container-lowest)',
            boxShadow: 'var(--shadow-card)',
            borderRadius: 'var(--radius-xl)',
            color: 'var(--outline)',
          }}
        >
          <MIcon name="pending_actions" size={48} />
          <p className="mt-4 text-sm">{t('workflow.aucunCycle')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {cycles.map(cycle => {
            const activeIndex = STEP_ORDER.indexOf(cycle.currentStep);
            const progressPercent = Math.round((activeIndex / (STEP_ORDER.length - 1)) * 100);

            return (
              <button
                key={cycle.id}
                type="button"
                onClick={() => navigate(`/admin/workflow/${cycle.id}`)}
                className="w-full text-left p-6 transition-all"
                style={{
                  background: 'var(--surface-container-lowest)',
                  boxShadow: 'var(--shadow-card)',
                  borderRadius: 'var(--radius-xl)',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-lg)';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-card)';
                  (e.currentTarget as HTMLElement).style.transform = 'none';
                }}
              >
                <div className="flex items-center justify-between flex-wrap gap-4">
                  {/* Left: info */}
                  <div className="flex-1 min-w-0">
                    <h3
                      className="text-lg font-bold truncate"
                      style={{ color: 'var(--on-surface)', fontFamily: 'var(--font-headline)' }}
                    >
                      {cycle.name}
                    </h3>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-xs" style={{ color: 'var(--on-surface-variant)' }}>
                        OSN: <strong>{cycle.osn}</strong>
                      </span>
                      <span className="text-xs" style={{ color: 'var(--on-surface-variant)' }}>
                        {t('workflow.soumisPar')}: {cycle.submittedBy}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--outline)' }}>
                        {cycle.submittedAt}
                      </span>
                    </div>
                  </div>

                  {/* Center: mini stepper */}
                  <div className="hidden md:block">
                    <MiniStepper currentStep={cycle.currentStep} />
                  </div>

                  {/* Right: score + action */}
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p
                        className="text-2xl font-extrabold"
                        style={{
                          color: cycle.score >= 75
                            ? 'var(--secondary)'
                            : cycle.score >= 50
                              ? 'var(--primary)'
                              : 'var(--error)',
                          fontFamily: 'var(--font-headline)',
                        }}
                      >
                        {cycle.score}%
                      </p>
                      <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--outline)' }}>
                        Score
                      </p>
                    </div>

                    <span
                      className="px-3 py-1 text-[10px] font-bold uppercase"
                      style={{
                        background: 'var(--secondary-container)',
                        color: 'var(--on-secondary-container)',
                        borderRadius: 'var(--radius-full)',
                      }}
                    >
                      {t(`workflow.steps.${cycle.currentStep}`)}
                    </span>

                    <span
                      className="text-xs font-semibold flex items-center gap-1"
                      style={{ color: 'var(--primary)' }}
                    >
                      {t('workflow.voirDetails')}
                      <MIcon name="chevron_right" size={14} />
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                  <div
                    className="w-full h-1 overflow-hidden"
                    style={{
                      background: 'var(--surface-container-highest)',
                      borderRadius: 'var(--radius-full)',
                    }}
                  >
                    <div
                      className="h-full"
                      style={{
                        width: `${progressPercent}%`,
                        background: 'var(--secondary)',
                        borderRadius: 'var(--radius-full)',
                        transition: 'width 500ms ease',
                      }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
