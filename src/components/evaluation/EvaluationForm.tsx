import { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { DimensionSection } from './DimensionSection';
import { EvaluationProgress } from './EvaluationProgress';
import { EvaluationWorkflowBadge } from './EvaluationWorkflowBadge';
import { useEvaluationActions, useScores, useEvaluationDetail } from '@/hooks/useEvaluation';
import { useReferentielStore } from '@/stores/referentielStore';
import { uploadPreuve, calculerScores } from '@/services/evaluationService';
import { getErpSnapshotCourant, type ErpSnapshot } from '@/services/erpService';
import { useAuthStore } from '@/stores/authStore';
import { useEvaluationStore, type ScoreInput } from '@/stores/evaluationStore';
import { SaveStatusIndicator, type SaveStatus } from '@/components/ui';
import { generatePrepSheet } from '@/services/pdf/prepSheet';

interface EvaluationFormProps {
  evalId: string;
}

export function EvaluationForm({ evalId }: EvaluationFormProps) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const referentiel = useReferentielStore(s => s.referentiel());
  const campagneMode = useEvaluationStore(s => s.campagneMode);
  const loadingScore = useEvaluationStore(s => s.loadingScore);
  const storeError = useEvaluationStore(s => s.error);
  // Indicateur réseau permanent (mesure 5) dérivé de l'état d'écriture par note.
  const saveStatus: SaveStatus = storeError
    ? 'error'
    : Object.values(loadingScore).some(Boolean) ? 'saving' : 'saved';

  // Souscrit en temps réel à l'évaluation — indispensable pour alimenter le store
  useEvaluationDetail(evalId);

  const {
    evaluation,
    criteresKO,
    loading,
    error,
    canSubmit,
    canEdit,
    enregistrerScore,
    soumettre,
    demarrer,
  } = useEvaluationActions();

  const {
    scores,
    nbCriteresRenseignes,
    nbCriteresTotal,
    progressionPercent,
  } = useScores(evalId);

  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [erpSnapshot, setErpSnapshot] = useState<ErpSnapshot | null>(null);

  // Snapshot ERP courant de l'organisation évaluée — informatif, souvent absent.
  useEffect(() => {
    const orgId = evaluation?.orgId;
    if (!orgId) return;
    let alive = true;
    void getErpSnapshotCourant(orgId).then(s => { if (alive) setErpSnapshot(s); }).catch(() => { /* pas d'ERP */ });
    return () => { alive = false; };
  }, [evaluation?.orgId]);

  // Calcul du score global et par dimension en temps réel
  const scoreResult = useMemo(
    () => referentiel
      ? calculerScores(
          scores,
          referentiel.dimensions.map(d => d.code),
          code => referentiel.dimensions.find(d => d.code === code)?.criteres ?? [],
          campagneMode
        )
      : { global: 0, parDimension: {} },
    [scores, referentiel, campagneMode]
  );

  const handleScoreChange = useCallback(
    async (score: ScoreInput) => {
      try {
        await enregistrerScore(score);
        // Si statut brouillon, passer en_cours automatiquement
        if (evaluation?.statut === 'brouillon') {
          await demarrer();
        }
      } catch {
        // L'erreur est déjà dans le store
      }
    },
    [enregistrerScore, demarrer, evaluation?.statut]
  );

  const handleUploadPreuve = useCallback(
    async (critereCode: string, file: File) => {
      if (!evaluation || !user) return;
      setUploadProgress(p => ({ ...p, [critereCode]: 0 }));
      try {
        await uploadPreuve({
          orgId: evaluation.orgId,
          campagneId: evaluation.campagneId,
          evalId: evaluation.id,
          critereCode,
          file,
          uploadedBy: user.id,
          onProgress: (percent) => {
            setUploadProgress(p => ({ ...p, [critereCode]: percent }));
          },
        });
        setUploadProgress(p => {
          const next = { ...p };
          delete next[critereCode];
          return next;
        });
      } catch {
        setUploadProgress(p => {
          const next = { ...p };
          delete next[critereCode];
          return next;
        });
      }
    },
    [evaluation, user]
  );

  // Mesure 3 : reprise au critère EXACT où l'utilisateur s'est arrêté (1er non répondu).
  const resume = useMemo(() => {
    if (!referentiel) return null;
    for (const dim of referentiel.dimensions) {
      const c = dim.criteres.find(cr => cr.actif && (campagneMode !== 'socle' || cr.socle !== false) && !(cr.code in scores));
      if (c) return { dimCode: dim.code, critereCode: c.code };
    }
    return null;
  }, [referentiel, scores, campagneMode]);
  const [reprisFait, setReprisFait] = useState(false);
  useEffect(() => {
    if (reprisFait || !resume || Object.keys(scores).length === 0) return;
    const el = document.getElementById(`critere-${resume.critereCode}`);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setReprisFait(true); }
  }, [resume, scores, reprisFait]);

  // Mesure 1 : fiche de préparation papier (socle si campagne socle).
  const handleFiche = useCallback(() => {
    if (!referentiel) return;
    const doc = generatePrepSheet(referentiel, campagneMode, { orgName: evaluation?.orgId });
    doc.save(`fiche-preparation-${referentiel.version}.pdf`);
  }, [referentiel, campagneMode, evaluation?.orgId]);

  const handleSoumettre = async () => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      await soumettre();
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !evaluation) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div
            className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"
            style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }}
          />
          <p className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>{t('common.chargement')}</p>
        </div>
      </div>
    );
  }

  if (!evaluation || !referentiel) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div
            className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"
            style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }}
          />
          <p className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>{t('common.chargement')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-lg p-4 text-sm"
        style={{ background: 'var(--danger-light)', border: '1px solid var(--danger)', color: 'var(--danger)' }}
      >
        {t('common.erreur')} : {error}
      </div>
    );
  }

  const isReadOnly = !canEdit;
  const isSubmitted = evaluation.statut === 'soumise' || evaluation.statut === 'validee' || evaluation.statut === 'cloturee';

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{t('evaluation.titre')}</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {t('evaluation.campagne')} — {evaluation.campagneId}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SaveStatusIndicator status={saveStatus} />
          <button
            type="button"
            onClick={handleFiche}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--surface-container-highest)', color: 'var(--primary)' }}
          >
            <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
            {t('evaluation.ficheReparation')}
          </button>
          <EvaluationWorkflowBadge statut={evaluation.statut} />
        </div>
      </div>

      {/* Bannière lecture seule */}
      {isSubmitted && (
        <div
          className="rounded-lg border px-4 py-3 text-sm"
          style={{ background: 'var(--primary-light)', borderColor: 'var(--primary-muted)', color: 'var(--primary)' }}
        >
          {t('evaluation.lectureSeule')}
        </div>
      )}

      {/* Bouton plan d'action (post-soumission) */}
      {isSubmitted && (
        <div
          className="rounded-xl px-5 py-4 flex items-center justify-between gap-4"
          style={{ background: 'var(--success-light)', border: '1px solid var(--success)' }}
        >
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--success-hover)' }}>
              {t('evaluation.planActionDisponible')}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--success-hover)', opacity: 0.8 }}>
              {t('evaluation.planActionDescription')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/plan-action?evalId=${evaluation.id}`)}
            className="flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{ background: 'var(--success)', color: 'white' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.9'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
          >
            {t('evaluation.voirPlanAction')}
          </button>
        </div>
      )}

      {/* Sections dimensions */}
      <div className="space-y-3">
        {referentiel.dimensions.map((dim, idx) => (
          <DimensionSection
            key={dim.code}
            dimension={dim}
            scores={scores}
            criteresKO={criteresKO}
            scoreDim={scoreResult.parDimension[dim.code] ?? 0}
            onScoreChange={handleScoreChange}
            onUploadPreuve={handleUploadPreuve}
            uploadProgress={uploadProgress}
            disabled={isReadOnly || loading}
            defaultOpen={resume ? dim.code === resume.dimCode : idx === 0}
            mode={campagneMode}
            erpSnapshot={erpSnapshot}
          />
        ))}
      </div>

      {/* Widget de progression sticky */}
      <EvaluationProgress
        scoreGlobal={scoreResult.global}
        nbRenseignes={nbCriteresRenseignes}
        nbTotal={nbCriteresTotal}
        criteresKO={criteresKO}
        sticky
      />

      {/* Erreur de soumission */}
      {submitError && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{ background: 'var(--danger-light)', border: '1px solid var(--danger)', color: 'var(--danger)' }}
        >
          {submitError}
        </div>
      )}

      {/* Bouton soumettre */}
      {!isReadOnly && (
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleSoumettre}
            disabled={!canSubmit || submitting}
            className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={
              canSubmit && !submitting
                ? { background: 'var(--primary)', color: 'white', boxShadow: 'var(--shadow-sm)' }
                : { background: 'var(--border-subtle)', color: 'var(--text-muted)' }
            }
          >
            {submitting && (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            {submitting ? t('evaluation.soumissionEnCours') : t('evaluation.soumettre')}
          </button>
        </div>
      )}
    </div>
  );
}
