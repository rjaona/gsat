/**
 * WorkflowDetailPage — Full detail view for a single campaign workflow.
 *
 * Layout: bento grid 12 columns
 * - Left (8 cols): stepper + role assignment grid + timeline
 * - Right (4 cols): cycle info + entity details + evidence summary
 *
 * Connected to Supabase via useCampagneStore + evaluationService.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCampagneStore } from '@/stores/campagneStore';
import { useAuthStore } from '@/stores/authStore';
import { listEvaluationsByCampagne, getPreuves } from '@/services/evaluationService';
import { getOrganisation } from '@/services/organisationService';
import { getUserProfile } from '@/services/authService';
import { writeAuditEntry } from '@/services/auditService';
import { createNotification } from '@/services/notificationService';
import { WorkflowStepper } from '@/components/workflow/WorkflowStepper';
import { RoleAssignmentGrid } from '@/components/workflow/RoleAssignmentGrid';
import { WorkflowTimeline } from '@/components/workflow/WorkflowTimeline';
import { EntityDetailsPanel } from '@/components/workflow/EntityDetailsPanel';
import { EvidenceSummary } from '@/components/workflow/EvidenceSummary';
import { AssignRoleModal } from '@/components/workflow/AssignRoleModal';
import type { Evaluation, CampagneStatut } from '@/types';
import type { WorkflowStep, RoleAssignment, AssignmentRole, WorkflowEvent, EntityDetails, EvidenceCategory } from '@/types/workflow';

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

// ── Helpers ──────────────────────────────────────────────────────────────────

function statutToStep(statut: CampagneStatut): WorkflowStep {
  switch (statut) {
    case 'planifiee': return 'initiation';
    case 'ouverte': return 'evaluation';
    case 'fermee': return 'approbation';
    case 'archivee': return 'finalisation';
    default: return 'initiation';
  }
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Component ────────────────────────────────────────────────────────────────

export function WorkflowDetailPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { selected: campagne, loading, select, clearSelected, updateStatut } = useCampagneStore();
  const { user, profile, role } = useAuthStore();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [evidenceCounts, setEvidenceCounts] = useState<EvidenceCategory[]>([]);
  const [actionLoading, setActionLoading] = useState<'renvoyer' | 'approuver' | 'download' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [commentSending, setCommentSending] = useState(false);
  const [assignRole, setAssignRole] = useState<AssignmentRole | null>(null);
  // Noms résolus depuis Supabase (organisation + créateur)
  const [organisateurName, setOrganisateurName] = useState<string>('');
  const [createdByName, setCreatedByName] = useState<string>('');
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load campaign
  useEffect(() => {
    if (campaignId) {
      select(campaignId);
    }
    return () => clearSelected();
  }, [campaignId, select, clearSelected]);

  // Load evaluations for this campaign
  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    listEvaluationsByCampagne(campaignId).then((evals) => {
      if (!cancelled) setEvaluations(evals);
    });
    return () => { cancelled = true; };
  }, [campaignId]);

  // Résoudre le nom de l'organisation (organisateurId) et du créateur (createdBy)
  useEffect(() => {
    if (!campagne) return;
    let cancelled = false;

    // Résolution du nom de l'organisation
    if (campagne.organisateurId) {
      getOrganisation(campagne.organisateurId)
        .then((org) => {
          if (!cancelled) setOrganisateurName(org?.nom ?? campagne.organisateurId);
        })
        .catch(() => {
          if (!cancelled) setOrganisateurName(campagne.organisateurId);
        });
    }

    // Résolution du nom du créateur (uid → prénom nom)
    if (campagne.createdBy) {
      getUserProfile(campagne.createdBy)
        .then((profile) => {
          if (!cancelled) {
            const name = profile
              ? `${profile.prenom} ${profile.nom}`.trim()
              : campagne.createdBy;
            setCreatedByName(name);
          }
        })
        .catch(() => {
          if (!cancelled) setCreatedByName(campagne.createdBy);
        });
    }

    return () => { cancelled = true; };
  }, [campagne]);

  // Derive evidence counts from evaluations
  useEffect(() => {
    if (evaluations.length === 0) return;
    let cancelled = false;
    // Load preuves for the first evaluation as a summary
    const firstEval = evaluations[0];
    if (firstEval) {
      getPreuves(firstEval.id).then((preuves) => {
        if (cancelled) return;
        setEvidenceCounts([
          { icon: 'description', label: t('workflow.evidenceDocuments', 'Documents'), count: preuves.length },
          { icon: 'assessment', label: t('workflow.evidenceEvaluations', 'Evaluations'), count: evaluations.length },
        ]);
      });
    }
    return () => { cancelled = true; };
  }, [evaluations, t]);

  // Derive workflow step from campaign statut
  const currentStep: WorkflowStep = campagne ? statutToStep(campagne.statut) : 'initiation';

  // Build role assignments from persisted campaign fields
  const assignments: RoleAssignment[] = useMemo(() => {
    if (!campagne) return [];

    // Evaluateur: validated if assigned AND evaluations submitted, in_progress if assigned
    const evalAssigned = !!campagne.evaluateurId;
    const evalHasSubmissions = evaluations.length > 0;
    const evalStatus = evalAssigned
      ? (evalHasSubmissions ? 'validated' : 'in_progress')
      : 'not_assigned';

    // Reviewer: in_progress if assigned AND campagne ouverte/fermee, validated if campagne archivee
    const reviewerAssigned = !!campagne.reviewerId;
    const reviewerStatus = reviewerAssigned
      ? (campagne.statut === 'archivee' ? 'validated' : 'in_progress')
      : 'not_assigned';

    // Approbateur: in_progress if assigned, validated if campagne archivee
    const approbateurAssigned = !!campagne.approbateurId;
    const approbateurStatus = approbateurAssigned
      ? (campagne.statut === 'archivee' ? 'validated' : 'in_progress')
      : 'not_assigned';

    const result: RoleAssignment[] = [
      {
        role: 'evaluateur',
        status: evalStatus,
        userId: campagne.evaluateurId,
        userName: campagne.evaluateurName,
        itemCount: evaluations.length,
        itemLabel: t('workflow.evaluations', 'evaluations'),
      },
      {
        role: 'reviewer',
        status: reviewerStatus,
        userId: campagne.reviewerId,
        userName: campagne.reviewerName,
      },
      {
        role: 'approbateur',
        status: approbateurStatus,
        userId: campagne.approbateurId,
        userName: campagne.approbateurName,
      },
    ];
    return result;
  }, [campagne, evaluations, t]);

  // Build timeline events from campaign lifecycle
  const events: WorkflowEvent[] = useMemo(() => {
    if (!campagne) return [];
    const evts: WorkflowEvent[] = [
      {
        id: 'e-created',
        action: t('workflow.eventCreated', 'Campaign created'),
        actor: campagne.createdBy,
        timestamp: new Date(campagne.createdAt),
        detail: campagne.nom,
      },
    ];
    if (campagne.statut !== 'planifiee') {
      evts.push({
        id: 'e-opened',
        action: t('workflow.eventOpened', 'Campaign opened'),
        actor: campagne.createdBy,
        timestamp: new Date(campagne.dateOuverture),
      });
    }
    // Add evaluation submission events
    for (const ev of evaluations) {
      if (ev.statut === 'soumise' || ev.statut === 'validee' || ev.statut === 'cloturee') {
        evts.push({
          id: `e-eval-${ev.id}`,
          action: t('workflow.eventEvalSubmitted', 'Evaluation submitted'),
          actor: ev.createdBy,
          timestamp: new Date(ev.updatedAt),
          detail: ev.scoreGlobal != null ? `Score: ${ev.scoreGlobal}%` : undefined,
        });
      }
    }
    if (campagne.statut === 'fermee' || campagne.statut === 'archivee') {
      evts.push({
        id: 'e-closed',
        action: t('workflow.eventClosed', 'Campaign closed'),
        timestamp: new Date(campagne.dateFermeture),
      });
    }
    return evts.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [campagne, evaluations, t]);

  // Entity details from campaign
  const entity: EntityDetails = useMemo(() => {
    if (!campagne) return { name: '', type: 'OSN' };
    // Compute average score from evaluations
    const scored = evaluations.filter((e) => e.scoreGlobal != null);
    const avgScore = scored.length > 0
      ? Math.round(scored.reduce((sum, e) => sum + (e.scoreGlobal ?? 0), 0) / scored.length)
      : undefined;
    return {
      name: organisateurName || campagne.organisateurId,
      type: 'OSN',
      contactPrincipal: createdByName || campagne.createdBy,
      conformityPercent: avgScore,
    };
  }, [campagne, evaluations, organisateurName, createdByName]);

  // Cycle info key-value pairs
  const cycleInfo = useMemo(() => {
    if (!campagne) return [];
    return [
      { labelKey: 'workflow.organisateur', value: organisateurName || campagne.organisateurId },
      { labelKey: 'workflow.cycleLabel', value: campagne.nom },
      { labelKey: 'workflow.soumisPar', value: createdByName || campagne.createdBy },
      { labelKey: 'workflow.dateSoumission', value: formatDate(campagne.dateOuverture) },
      { labelKey: 'workflow.delaiValidation', value: formatDate(campagne.dateFermeture) },
    ];
  }, [campagne, organisateurName, createdByName]);

  // Average score
  const avgScore = useMemo(() => {
    const scored = evaluations.filter((e) => e.scoreGlobal != null);
    if (scored.length === 0) return 0;
    return Math.round(scored.reduce((sum, e) => sum + (e.scoreGlobal ?? 0), 0) / scored.length);
  }, [evaluations]);

  // ── Clear success message after delay ──
  const showSuccess = useCallback((msg: string) => {
    setActionSuccess(msg);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => setActionSuccess(null), 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  // ── Handler: Renvoyer pour modifications ──
  const handleRenvoyer = useCallback(async () => {
    if (!campagne || !campaignId) return;
    setActionLoading('renvoyer');
    setActionError(null);
    try {
      await updateStatut(campaignId, 'ouverte');
      await writeAuditEntry({
        userId: user?.id ?? '',
        userEmail: user?.email ?? '',
        action: 'update',
        resource: 'campagne',
        resourceId: campaignId,
        metadata: { action: 'renvoyer_modifications', previousStatut: campagne.statut },
      });
      // Notifier silencieusement l'évaluateur assigné
      const actorName = profile?.prenom && profile?.nom
        ? `${profile.prenom} ${profile.nom}`.trim()
        : (user?.email ?? '');
      if (campagne.evaluateurId) {
        createNotification({
          type: 'workflow_renvoye',
          title: 'Cycle renvoyé pour modifications',
          message: `Le cycle "${campagne.nom}" a été renvoyé pour modifications. Veuillez mettre à jour les évaluations.`,
          recipientId: campagne.evaluateurId,
          senderId: user?.id,
          senderName: actorName,
          resourceType: 'campagne',
          resourceId: campaignId,
        }).catch(() => {});
      }

      showSuccess(t('workflow.renvoyerSuccess', 'Cycle renvoy\u00e9 pour modifications'));
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setActionLoading(null);
    }
  }, [campagne, campaignId, updateStatut, user, profile, t, showSuccess]);

  // ── Handler: Approuver le cycle ──
  const handleApprouver = useCallback(async () => {
    if (!campagne || !campaignId) return;
    // B3 — Vérifier que les 3 rôles sont assignés avant d'approuver
    if (!campagne.evaluateurId || !campagne.reviewerId || !campagne.approbateurId) {
      setActionError(t('workflow.rolesManquantsAvantApprobation', 'Tous les rôles doivent être assignés avant l\'approbation'));
      return;
    }
    const nextStatut: CampagneStatut = campagne.statut === 'fermee' ? 'archivee' : 'fermee';
    setActionLoading('approuver');
    setActionError(null);
    try {
      await updateStatut(campaignId, nextStatut);
      await writeAuditEntry({
        userId: user?.id ?? '',
        userEmail: user?.email ?? '',
        action: 'validate',
        resource: 'campagne',
        resourceId: campaignId,
        metadata: { action: 'approuver_cycle', newStatut: nextStatut },
      });

      // Notifier silencieusement les rôles concernés (évaluateur, reviewer, approbateur)
      const approverName = profile?.prenom && profile?.nom
        ? `${profile.prenom} ${profile.nom}`.trim()
        : (user?.email ?? '');
      const recipientIds = [campagne.evaluateurId, campagne.reviewerId, campagne.approbateurId]
        .filter((id): id is string => !!id && id !== user?.id);
      for (const recipientId of recipientIds) {
        createNotification({
          type: 'workflow_approved',
          title: 'Cycle approuvé',
          message: `Le cycle "${campagne.nom}" a été approuvé${nextStatut === 'archivee' ? ' et archivé' : ''}.`,
          recipientId,
          senderId: user?.id,
          senderName: approverName,
          resourceType: 'campagne',
          resourceId: campaignId,
        }).catch(() => {});
      }

      showSuccess(t('workflow.approuverSuccess', 'Cycle approuv\u00e9 avec succ\u00e8s'));
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setActionLoading(null);
    }
  }, [campagne, campaignId, updateStatut, user, profile, t, showSuccess]);

  // ── Handler: Assigner un r\u00f4le ──
  const handleAssign = useCallback((role: RoleAssignment['role']) => {
    setAssignRole(role);
  }, []);

  // ── Handler: Assignment completed ──
  const handleAssignmentComplete = useCallback(() => {
    setAssignRole(null);
    showSuccess(t('workflow.assignmentSuccess'));
    // Re-fetch campaign to reflect updated assignments
    if (campaignId) {
      select(campaignId);
    }
  }, [t, showSuccess, campaignId, select]);

  // ── Handler: T\u00e9l\u00e9charger archive preuves ──
  const handleDownloadArchive = useCallback(async () => {
    if (evaluations.length === 0) return;
    setActionLoading('download');
    setActionError(null);
    try {
      // Collect all preuves download URLs from all evaluations
      const allPreuves = await Promise.all(
        evaluations.map(ev => getPreuves(ev.id))
      );
      const flatPreuves = allPreuves.flat();

      if (flatPreuves.length === 0) {
        setActionError(t('workflow.noEvidenceToDownload', 'Aucune preuve \u00e0 t\u00e9l\u00e9charger'));
        return;
      }

      // Download each evidence file sequentially with a delay to avoid popup blockers
      for (const preuve of flatPreuves) {
        if ('downloadUrl' in preuve && typeof (preuve as Record<string, unknown>)['downloadUrl'] === 'string') {
          const link = document.createElement('a');
          link.href = (preuve as Record<string, unknown>)['downloadUrl'] as string;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.download = preuve.nom;
          link.click();
          await new Promise(resolve => setTimeout(resolve, 400));
        }
      }

      showSuccess(t('workflow.downloadStarted', 'T\u00e9l\u00e9chargement lanc\u00e9'));
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setActionLoading(null);
    }
  }, [evaluations, t, showSuccess]);

  // ── Handler: Envoyer commentaire ──
  const handleSubmitComment = useCallback(async () => {
    if (!comment.trim() || !campaignId) return;
    setCommentSending(true);
    try {
      await writeAuditEntry({
        userId: user?.id ?? '',
        userEmail: user?.email ?? '',
        action: 'update',
        resource: 'campagne',
        resourceId: campaignId,
        metadata: { action: 'comment', comment: comment.trim(), userName: profile ? `${profile.prenom} ${profile.nom}` : (user?.email ?? '') },
      });
      setComment('');
      showSuccess(t('workflow.commentaireSent', 'Commentaire enregistr\u00e9'));
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setCommentSending(false);
    }
  }, [comment, campaignId, user, profile, t, showSuccess]);

  const cycleName = campagne?.nom ?? '...';

  if (loading && !campagne) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <MIcon name="sync" size={48} />
        <p className="ml-4 text-sm" style={{ color: 'var(--outline)' }}>
          {t('common.loading', 'Loading...')}
        </p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-[1400px] mx-auto w-full">

      {/* Header */}
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <nav
            className="flex items-center gap-2 text-xs mb-2"
            style={{ color: 'var(--on-surface-variant)' }}
            aria-label="Breadcrumb"
          >
            <button
              type="button"
              onClick={() => navigate('/admin/workflow')}
              className="hover:underline"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', font: 'inherit' }}
            >
              {t('workflow.title')}
            </button>
            <MIcon name="chevron_right" size={12} />
            <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
              {t('workflow.cyclesEnCours')}
            </span>
          </nav>
          <h2
            className="text-4xl font-extrabold tracking-tight"
            style={{ color: 'var(--primary)', fontFamily: 'var(--font-headline)' }}
          >
            {t('workflow.detailsCycle')} :{' '}
            <span style={{ color: 'var(--on-surface-variant)', fontWeight: 300 }}>
              {cycleName}
            </span>
          </h2>
        </div>
        {/* B1 — Boutons visibles uniquement pour les rôles autorisés */}
        {/* I8 — Masquer les boutons si la campagne est archivée */}
        {(['admin_global', 'responsable_region', 'responsable_osn'] as const).includes(role as 'admin_global' | 'responsable_region' | 'responsable_osn') &&
          campagne?.statut !== 'archivee' && (
          <div className="flex gap-3">
            {/* B2 — "Renvoyer" uniquement si statut === 'fermee' */}
            {campagne?.statut === 'fermee' && (
              <button
                type="button"
                onClick={handleRenvoyer}
                disabled={actionLoading !== null}
                className="px-6 py-2.5 text-sm font-semibold transition-colors"
                style={{
                  background: 'var(--surface-container-highest)',
                  color: 'var(--on-surface)',
                  borderRadius: 'var(--radius-xl)',
                  border: 'none',
                  cursor: actionLoading ? 'wait' : 'pointer',
                  opacity: actionLoading === 'renvoyer' ? 0.6 : 1,
                }}
              >
                {actionLoading === 'renvoyer' ? t('common.loading', 'Loading...') : t('workflow.renvoyerModifications')}
              </button>
            )}
            {/* B3 — "Approuver" désactivé si les 3 rôles ne sont pas assignés */}
            {(() => {
              const rolesComplets = !!(campagne?.evaluateurId && campagne?.reviewerId && campagne?.approbateurId);
              return (
                <button
                  type="button"
                  onClick={handleApprouver}
                  disabled={actionLoading !== null || !rolesComplets}
                  title={!rolesComplets ? t('workflow.rolesManquantsAvantApprobation', 'Tous les rôles doivent être assignés avant l\'approbation') : undefined}
                  className="px-6 py-2.5 text-sm font-bold transition-all"
                  style={{
                    background: 'var(--gradient-primary)',
                    color: 'white',
                    borderRadius: 'var(--radius-xl)',
                    border: 'none',
                    cursor: (actionLoading || !rolesComplets) ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(21,35,110,0.25)',
                    opacity: (actionLoading === 'approuver' || !rolesComplets) ? 0.5 : 1,
                  }}
                >
                  {actionLoading === 'approuver' ? t('common.loading', 'Loading...') : t('workflow.approuverCycle')}
                </button>
              );
            })()}
          </div>
        )}
      </div>

      {/* Feedback banners */}
      {actionError && (
        <div
          className="p-4 text-sm flex items-center gap-2"
          style={{
            background: 'var(--error-container)',
            color: 'var(--on-error-container)',
            borderRadius: 'var(--radius-xl)',
          }}
          role="alert"
        >
          <MIcon name="error" size={18} />
          {actionError}
          <button
            type="button"
            onClick={() => setActionError(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <MIcon name="close" size={16} />
          </button>
        </div>
      )}
      {actionSuccess && (
        <div
          className="p-4 text-sm flex items-center gap-2"
          style={{
            background: 'var(--secondary-container)',
            color: 'var(--on-secondary-container)',
            borderRadius: 'var(--radius-xl)',
          }}
          role="status"
        >
          <MIcon name="check_circle" size={18} />
          {actionSuccess}
        </div>
      )}

      {/* Bento grid */}
      <div className="grid grid-cols-12 gap-8">

        {/* Main content — 8 cols */}
        <div className="col-span-12 lg:col-span-8 space-y-8">

          {/* Stepper */}
          <WorkflowStepper currentStep={currentStep} />

          {/* Role Assignment Grid */}
          <section>
            <h3
              className="text-sm font-bold uppercase tracking-widest mb-4"
              style={{ color: 'var(--on-surface-variant)' }}
            >
              {t('workflow.assignationRoles')}
            </h3>
            <RoleAssignmentGrid
              assignments={assignments}
              onAssign={handleAssign}
            />
          </section>

          {/* Timeline */}
          <WorkflowTimeline events={events} />
        </div>

        {/* Sidebar — 4 cols */}
        <aside className="col-span-12 lg:col-span-4 space-y-6">

          {/* Cycle info */}
          <div
            className="p-6 space-y-4"
            style={{
              background: 'var(--surface-container-lowest)',
              boxShadow: 'var(--shadow-card)',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <h4
              className="text-sm font-bold"
              style={{ color: 'var(--on-surface)', fontFamily: 'var(--font-headline)' }}
            >
              {t('workflow.informationsCycle')}
            </h4>
            {cycleInfo.map(r => (
              <div key={r.labelKey} className="flex justify-between items-baseline">
                <span
                  className="text-[11px] font-bold uppercase tracking-widest"
                  style={{ color: 'var(--on-surface-variant)' }}
                >
                  {r.labelKey.includes('.') ? t(r.labelKey) : r.labelKey}
                </span>
                <span
                  className="text-sm font-semibold"
                  style={{ color: 'var(--on-surface)' }}
                >
                  {r.value}
                </span>
              </div>
            ))}
          </div>

          {/* Score summary */}
          <div
            className="p-6 text-center"
            style={{
              background: 'var(--gradient-primary)',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <p className="text-xs font-bold uppercase tracking-widest text-white/70 mb-2">
              {t('workflow.scoreGlobal')}
            </p>
            <p
              className="text-6xl font-extrabold text-white leading-none"
              style={{ fontFamily: 'var(--font-headline)' }}
            >
              {avgScore}%
            </p>
            <p className="text-xs text-white/60 mt-2">
              {t('workflow.enAttenteApprobation')}
            </p>
          </div>

          {/* Entity details */}
          <EntityDetailsPanel entity={entity} />

          {/* Evidence summary */}
          <EvidenceSummary
            categories={evidenceCounts}
            onDownload={handleDownloadArchive}
          />

          {/* Comments */}
          <div
            className="p-6"
            style={{
              background: 'var(--surface-container-lowest)',
              boxShadow: 'var(--shadow-card)',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <h4
              className="text-sm font-bold mb-3"
              style={{ color: 'var(--on-surface)', fontFamily: 'var(--font-headline)' }}
            >
              {t('workflow.commentaires')}
            </h4>
            <textarea
              placeholder={t('workflow.commentairePlaceholder')}
              rows={4}
              value={comment}
              onChange={e => setComment(e.target.value)}
              className="w-full px-4 py-3 text-sm outline-none resize-none"
              style={{
                background: 'var(--surface-container-highest)',
                border: '2px solid transparent',
                borderRadius: 'var(--radius-lg)',
                color: 'var(--on-surface)',
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.background = 'var(--surface-container-lowest)';
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = 'transparent';
                e.currentTarget.style.background = 'var(--surface-container-highest)';
              }}
            />
            {comment.trim() && (
              <button
                type="button"
                onClick={handleSubmitComment}
                disabled={commentSending}
                className="mt-2 w-full px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                style={{
                  background: 'var(--primary)',
                  color: 'white',
                  borderRadius: 'var(--radius-xl)',
                  border: 'none',
                  cursor: commentSending ? 'wait' : 'pointer',
                  opacity: commentSending ? 0.6 : 1,
                }}
              >
                <MIcon name="send" size={14} />
                {commentSending ? t('common.loading', 'Loading...') : t('workflow.envoyerCommentaire', 'Envoyer')}
              </button>
            )}
          </div>
        </aside>
      </div>

      {/* Assign Role Modal */}
      {assignRole && campaignId && (
        <AssignRoleModal
          isOpen={!!assignRole}
          role={assignRole}
          campaignId={campaignId}
          currentUserId={campagne?.[`${assignRole}Id`]}
          onClose={() => setAssignRole(null)}
          onAssigned={handleAssignmentComplete}
        />
      )}
    </div>
  );
}
