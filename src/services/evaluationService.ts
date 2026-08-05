import { supabase } from './supabase';
import { uploadEvidenceResumable } from './storageService';
import type { Evaluation, EvaluationStatut, EvaluationType, Score, Preuve, DimensionDef, UserRole } from '@/types';
import type { Database } from '@/types/supabase.generated';
import { calculerScoreDimension, calculerScoreGlobal } from './referentielService';
import {
  canTransitionTo,
  verifierTransition,
  verifierAutoValidation,
  calculerEcheanceRevue,
} from './evaluationWorkflow';
import { createNotification } from './notificationService';
import { getCampagne } from './campagneService';

// ── Transitions de statut ────────────────────────────────────────────────────
// La machine à états vit dans `evaluationWorkflow.ts` : pure, testable sans
// Supabase, et porteuse des règles de rôle et de périmètre.
export { canTransitionTo } from './evaluationWorkflow';

// ── Conversion DB → type applicatif ──────────────────────────────────────────

function rowToEval(row: Record<string, unknown>): Evaluation {
  return {
    id:                    row['id']                     as string,
    campagneId:            row['campagne_id']            as string,
    orgId:                 row['org_id']                 as string,
    type:                  row['type']                   as EvaluationType,
    statut:                row['statut']                 as EvaluationStatut,
    scoreGlobal:           row['score_global']           as number | undefined,
    scoreParDimension:     row['score_par_dimension']    as Record<string, number> | undefined,
    submittedBy:           row['submitted_by']           as string | undefined,
    submittedAt:           row['submitted_at']           as string | undefined,
    reviewerName:          row['reviewer_name']          as string | undefined,
    reviewerTitle:         row['reviewer_title']         as string | undefined,
    reviewerAvatar:        row['reviewer_avatar']        as string | undefined,
    reviewerRecommendation: row['reviewer_recommendation'] as string | undefined,
    reviewerVerdict:       row['reviewer_verdict']       as Evaluation['reviewerVerdict'],
    // Auto-validation Faritany + revue nationale a posteriori
    valideePar:            row['validee_par']            as string | undefined,
    valideeAt:             row['validee_at']             as string | undefined,
    pvComitePath:          row['pv_comite_path']         as string | undefined,
    revueEcheanceAt:       row['revue_echeance_at']      as string | undefined,
    revuePar:              row['revue_par']              as string | undefined,
    revueAt:               row['revue_at']               as string | undefined,
    revueMotif:            row['revue_motif']            as string | undefined,
    clotureeAuto:          (row['cloturee_auto'] as boolean | undefined) ?? false,
    createdBy:             row['created_by']             as string,
    createdAt:             row['created_at']             as string,
    updatedAt:             row['updated_at']             as string,
  };
}

// ── Lecture ponctuelle ────────────────────────────────────────────────────────

export async function getEvaluation(id: string): Promise<Evaluation | null> {
  const { data, error } = await supabase
    .from('evaluations').select('*').eq('id', id).single();
  if (error || !data) return null;
  return rowToEval(data as Record<string, unknown>);
}

export async function listEvaluationsByCampagne(campagneId: string): Promise<Evaluation[]> {
  const { data, error } = await supabase
    .from('evaluations').select('*')
    .eq('campagne_id', campagneId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(r => rowToEval(r as Record<string, unknown>));
}

export async function listEvaluationsByOrg(orgId: string): Promise<Evaluation[]> {
  const { data, error } = await supabase
    .from('evaluations').select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(r => rowToEval(r as Record<string, unknown>));
}

/**
 * File de la revue nationale : évaluations validées en attente de revue
 * (statut='validee' ET revue_at IS NULL). La RLS (evals_select) restreint déjà
 * au sous-arbre de l'OSN du relecteur ; le tri par risque se fait côté page.
 */
export async function listEvaluationsARevoir(): Promise<Evaluation[]> {
  const { data, error } = await supabase
    .from('evaluations').select('*')
    .eq('statut', 'validee')
    .is('revue_at', null);
  if (error) throw error;
  return (data ?? []).map(r => rowToEval(r as Record<string, unknown>));
}

export async function getEvaluationForOrgCampagne(
  orgId: string, campagneId: string
): Promise<Evaluation | null> {
  const { data, error } = await supabase
    .from('evaluations').select('*')
    .eq('org_id', orgId).eq('campagne_id', campagneId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToEval(data as Record<string, unknown>) : null;
}

// ── Lecture des scores ────────────────────────────────────────────────────────

export async function getScores(evalId: string): Promise<Score[]> {
  const { data, error } = await supabase
    .from('evaluation_scores').select('*').eq('eval_id', evalId);
  if (error) throw error;
  return (data ?? []).map(r => {
    const row         = r as Record<string, unknown>;
    const commentaire = row['commentaire'] as string | null | undefined;
    return {
      critereCode: row['critere_code'] as string,
      note:        row['note']         as Score['note'],
      updatedBy:   row['updated_by']   as string,
      updatedAt:   row['updated_at']   as string,
      ...(commentaire != null ? { commentaire } : {}),
    };
  });
}

// ── Abonnement temps réel ─────────────────────────────────────────────────────

export function subscribeEvaluation(
  id: string,
  onData: (evaluation: Evaluation | null) => void,
  onError?: (err: Error) => void
): () => void {
  const fetch = () =>
    supabase.from('evaluations').select('*').eq('id', id).maybeSingle()
      .then(({ data, error }) => {
        if (error) { onError?.(error); return; }
        onData(data ? rowToEval(data as Record<string, unknown>) : null);
      });

  void fetch();

  const ch = supabase.channel(`eval-${id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'evaluations', filter: `id=eq.${id}` },
      () => void fetch())
    .subscribe();
  return () => { void supabase.removeChannel(ch); };
}

export function subscribeEvaluationScores(
  evalId: string,
  onData: (scores: Score[]) => void,
  onError?: (err: Error) => void
): () => void {
  const fetch = () =>
    supabase.from('evaluation_scores').select('*').eq('eval_id', evalId)
      .then(({ data, error }) => {
        if (error) { onError?.(error); return; }
        onData((data ?? []).map(r => {
          const row = r as Record<string, unknown>;
          const commentaire = row['commentaire'] as string | null | undefined;
          return {
            critereCode: row['critere_code'] as string,
            note:        row['note']         as Score['note'],
            updatedBy:   row['updated_by']   as string,
            updatedAt:   row['updated_at']   as string,
            ...(commentaire != null ? { commentaire } : {}),
          };
        }));
      });

  void fetch();

  const ch = supabase.channel(`scores-${evalId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'evaluation_scores', filter: `eval_id=eq.${evalId}` },
      () => void fetch())
    .subscribe();
  return () => { void supabase.removeChannel(ch); };
}

export function subscribeAllEvaluations(
  onData: (evaluations: Evaluation[]) => void,
  onError?: (err: Error) => void
): () => void {
  const fetch = () =>
    supabase.from('evaluations').select('*').order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) { onError?.(error); return; }
        onData((data ?? []).map(r => rowToEval(r as Record<string, unknown>)));
      });

  void fetch();

  const ch = supabase.channel('evaluations-all')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'evaluations' }, () => void fetch())
    .subscribe();
  return () => { void supabase.removeChannel(ch); };
}

export function subscribeEvaluationsByOrg(
  orgId: string,
  onData: (evaluations: Evaluation[]) => void,
  onError?: (err: Error) => void
): () => void {
  const fetch = () =>
    supabase.from('evaluations').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) { onError?.(error); return; }
        onData((data ?? []).map(r => rowToEval(r as Record<string, unknown>)));
      });

  void fetch();

  const ch = supabase.channel(`evals-org-${orgId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'evaluations', filter: `org_id=eq.${orgId}` },
      () => void fetch())
    .subscribe();
  return () => { void supabase.removeChannel(ch); };
}

export function subscribeEvaluationsByCampagne(
  campagneId: string,
  onData: (evaluations: Evaluation[]) => void,
  onError?: (err: Error) => void
): () => void {
  const fetch = () =>
    supabase.from('evaluations').select('*').eq('campagne_id', campagneId).order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) { onError?.(error); return; }
        onData((data ?? []).map(r => rowToEval(r as Record<string, unknown>)));
      });

  void fetch();

  const ch = supabase.channel(`evals-campagne-${campagneId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'evaluations', filter: `campagne_id=eq.${campagneId}` },
      () => void fetch())
    .subscribe();
  return () => { void supabase.removeChannel(ch); };
}

// ── Création ──────────────────────────────────────────────────────────────────

export type EvaluationPayload = { campagneId: string; orgId: string; type: EvaluationType; };
export interface CreateEvaluationOptions {
  recipientId?: string | undefined;
  creatorName?: string | undefined;
  orgName?: string | undefined;
}

export async function createEvaluation(
  payload: EvaluationPayload,
  createdBy: string,
  options?: CreateEvaluationOptions,
): Promise<string> {
  // Vérification statut et dates de la campagne
  const campagne = await getCampagne(payload.campagneId);
  if (!campagne) throw new Error(`Campagne introuvable : ${payload.campagneId}`);
  if (campagne.statut !== 'ouverte') {
    throw new Error(`Impossible de créer une évaluation : la campagne "${campagne.nom}" n'est pas ouverte (statut : "${campagne.statut}").`);
  }
  const now = new Date();
  const dateOuverture = new Date(campagne.dateOuverture);
  const dateFermeture = new Date(campagne.dateFermeture);
  if (now < dateOuverture) {
    throw new Error(`Campagne "${campagne.nom}" n'a pas encore commencé (ouverture le ${dateOuverture.toLocaleDateString('fr-FR')}).`);
  }
  if (now > dateFermeture) {
    throw new Error(`Campagne "${campagne.nom}" est expirée (fermeture le ${dateFermeture.toLocaleDateString('fr-FR')}).`);
  }

  // INSERT avec UNIQUE(org_id, campagne_id) — la contrainte remplace evaluation_locks
  const { data, error } = await supabase
    .from('evaluations')
    .insert({
      campagne_id: payload.campagneId,
      org_id:      payload.orgId,
      type:        payload.type,
      statut:      'brouillon' as EvaluationStatut,
      created_by:  createdBy,
    })
    .select('id')
    .single();

  // Code 23505 = unique_violation PostgreSQL
  if (error) {
    if (error.code === '23505') {
      throw new Error('Une évaluation existe déjà pour cette organisation dans cette campagne.');
    }
    throw error;
  }

  const id = (data as { id: string }).id;

  if (options?.recipientId) {
    void createNotification({
      type: 'evaluation_created', title: 'Nouvelle évaluation créée',
      message: `Une nouvelle évaluation a été créée pour ${options.orgName ?? payload.orgId}.`,
      recipientId: options.recipientId, senderId: createdBy, senderName: options.creatorName,
      resourceType: 'evaluation', resourceId: id,
    }).catch(() => {});
  }

  return id;
}

// ── Mise à jour de statut ─────────────────────────────────────────────────────

export interface UpdateStatutOptions {
  submitterId?:  string | undefined;
  submitterName?: string | undefined;
  recipientId?:  string | undefined;
  orgName?:      string | undefined;
  ancienStatut?: EvaluationStatut | undefined;
}

export async function updateStatutEvaluation(
  id: string,
  statut: EvaluationStatut,
  options?: UpdateStatutOptions,
): Promise<void> {
  // Lire + valider la transition
  const { data: current, error: readErr } = await supabase
    .from('evaluations').select('statut').eq('id', id).single();
  if (readErr || !current) throw new Error(`Évaluation introuvable : ${id}`);

  const currentStatut = (current as { statut: EvaluationStatut }).statut;
  if (!canTransitionTo(currentStatut, statut)) {
    throw new Error(`Transition de statut invalide : "${currentStatut}" → "${statut}"`);
  }

  const updateData: Record<string, unknown> = { statut };
  if (statut === 'soumise' && options?.submitterId) {
    updateData['submitted_by'] = options.submitterId;
    updateData['submitted_at'] = new Date().toISOString();
  }

  const { error } = await supabase.from('evaluations').update(updateData as unknown as Database['public']['Tables']['evaluations']['Update']).eq('id', id);
  if (error) throw error;

  // Notifications silencieuses
  if (statut === 'soumise' && options?.recipientId) {
    void createNotification({
      type: 'evaluation_submitted', title: 'Évaluation soumise',
      message: `L'évaluation de ${options.orgName ?? 'une organisation'} a été soumise pour revue.`,
      recipientId: options.recipientId, senderId: options.submitterId, senderName: options.submitterName,
      resourceType: 'evaluation', resourceId: id,
    }).catch(() => {});
  }
  if (statut === 'validee' && options?.recipientId) {
    void createNotification({
      type: 'evaluation_validated', title: 'Évaluation validée',
      message: `L'évaluation de ${options.orgName ?? 'une organisation'} a été validée.`,
      recipientId: options.recipientId, senderId: options.submitterId, senderName: options.submitterName,
      resourceType: 'evaluation', resourceId: id,
    }).catch(() => {});
  }
  if (statut === 'en_cours' && options?.ancienStatut === 'soumise' && options?.recipientId) {
    void createNotification({
      type: 'evaluation_rejected', title: 'Révision demandée',
      message: `L'évaluation de ${options.orgName ?? 'une organisation'} a été renvoyée pour modifications.`,
      recipientId: options.recipientId, senderId: options.submitterId, senderName: options.submitterName,
      resourceType: 'evaluation', resourceId: id,
    }).catch(() => {});
  }
}

// ── Écriture d'un score ───────────────────────────────────────────────────────

/**
 * Écrit une note. TROIS états, trois comportements — c'est ici que vit le
 * correctif C4 :
 *
 *   note = 0..3      → ligne présente avec la note
 *   note = null      → NON APPLICABLE : ligne présente, note NULL.
 *                      Le critère sort du numérateur ET du dénominateur.
 *   note = undefined → PAS RÉPONDU : la ligne est SUPPRIMÉE.
 *                      Le critère compte 0 avec plein poids.
 *
 * Écrire un null au lieu de supprimer ferait monter le score au lieu de le
 * faire baisser. Le trigger on_score_write se déclenche déjà sur DELETE :
 * le recalcul suit tout seul.
 */
export async function writeScore(
  evalId: string,
  score: { critereCode: string; note: 0 | 1 | 2 | 3 | null | undefined; commentaire?: string | undefined },
  updatedBy: string,
): Promise<void> {
  // Pas de note ET pas de commentaire à conserver → on efface la ligne.
  if (score.note === undefined && !score.commentaire) {
    const { error } = await supabase
      .from('evaluation_scores')
      .delete()
      .eq('eval_id', evalId)
      .eq('critere_code', score.critereCode);
    if (error) throw error;
    return;
  }

  // Cas limite assumé : un critère sans note mais avec un commentaire garde sa
  // ligne (note NULL), donc compte comme N/A. On préfère ça à perdre le
  // commentaire de quelqu'un qui efface sa note.
  const { error } = await supabase
    .from('evaluation_scores')
    .upsert({
      eval_id:      evalId,
      critere_code: score.critereCode,
      note:         score.note ?? null,
      commentaire:  score.commentaire ?? null,
      updated_by:   updatedBy,
      updated_at:   new Date().toISOString(),
    }, { onConflict: 'eval_id,critere_code' });
  if (error) throw error;
}

// ── Calcul de scores (logique pure — inchangée) ───────────────────────────────

export interface ScoreResult {
  global: number;
  /** null = dimension non comptable (vide, inactive, ou entièrement N/A). */
  parDimension: Record<string, number | null>;
}

export function calculerScores(
  scoresMap: Record<string, Score>,
  dimensionCodes: string[],
  getCriteresPourDimension: (code: string) => Array<{ code: string; socle?: boolean; essentiel?: boolean }>,
  mode: 'socle' | 'complet' = 'complet',
): ScoreResult {
  const notesParCode: Record<string, number | null> = {};
  for (const [code, score] of Object.entries(scoresMap)) {
    notesParCode[code] = score.note;
  }

  const dimensionDefs: DimensionDef[] = dimensionCodes.map(code => ({
    code, nom: { fr: code, en: code }, ordre: 0,
    criteres: getCriteresPourDimension(code).map(c => ({
      code: c.code,
      actif: true,
      // Auparavant `essentiel: false` en dur : par ce chemin, un critère
      // essentiel non conforme n'était JAMAIS détecté.
      essentiel: c.essentiel ?? false,
      socle: c.socle ?? true,
      sourceCodes: [],
      indicateurErp: [],
      ordre: 0,
      libelle: { fr: '', en: '' },
    })),
  }));

  const parDimension: Record<string, number | null> = {};
  for (const dim of dimensionDefs) {
    parDimension[dim.code] = calculerScoreDimension(notesParCode, dim, mode);
  }

  const global = calculerScoreGlobal(
    notesParCode,
    { version: '', nom: { fr: '', en: '' }, actif: true, dimensions: dimensionDefs },
    mode,
  );

  return { global, parDimension };
}

// ── Upload de preuves ─────────────────────────────────────────────────────────

export interface UploadPreuveOptions {
  orgId: string; campagneId: string; evalId: string;
  critereCode: string; file: File; uploadedBy: string;
  onProgress?: (percent: number) => void;
}

export async function uploadPreuve(options: UploadPreuveOptions): Promise<Preuve> {
  const { orgId, campagneId, evalId, critereCode, file, uploadedBy, onProgress } = options;
  const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const storagePath = `preuves/${orgId}/${campagneId}/${evalId}/${critereCode}/${fileName}`;

  await uploadEvidenceResumable(storagePath, file, onProgress);

  const { data, error } = await supabase
    .from('evaluation_preuves')
    .insert({
      eval_id:     evalId,
      critere_code: critereCode,
      storage_path: storagePath,
      nom:          file.name,
      type_mime:    file.type,
      taille:       file.size,
      uploaded_by:  uploadedBy,
    })
    .select('id, uploaded_at')
    .single();
  if (error) throw error;

  return {
    id:          (data as Record<string, unknown>)['id']          as string,
    evalId,
    critereCode,
    storagePath,
    nom:         file.name,
    typeMime:    file.type,
    taille:      file.size,
    uploadedBy,
    uploadedAt:  (data as Record<string, unknown>)['uploaded_at'] as string,
  };
}

export async function getPreuves(evalId: string, critereCode?: string): Promise<Preuve[]> {
  let q = supabase.from('evaluation_preuves').select('*').eq('eval_id', evalId);
  if (critereCode) q = q.eq('critere_code', critereCode);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(r => {
    const row = r as Record<string, unknown>;
    return {
      id:          row['id']           as string,
      evalId:      row['eval_id']      as string,
      critereCode: row['critere_code'] as string,
      storagePath: row['storage_path'] as string,
      nom:         row['nom']          as string,
      typeMime:    row['type_mime']    as string,
      taille:      row['taille']       as number,
      uploadedBy:  row['uploaded_by']  as string,
      uploadedAt:  row['uploaded_at']  as string,
    };
  });
}

// ── Auto-validation Faritany et revue nationale a posteriori ──────────────────

export interface AutoValiderOptions {
  /** Chemin Storage du PV de comité — obligatoire, garde-fou côté SQL aussi. */
  pvComitePath: string;
  essentielsKO: string[];
  confirmeMalgreEssentiels?: boolean | undefined;
  valideePar: string;
  role: UserRole;
  userOrgId: string;
  evalOrgId: string;
  /** system_config.revue_delai_jours de l'OSN parente. 60 par défaut. */
  delaiRevueJours?: number | undefined;
  /** Responsable national à prévenir. */
  recipientId?: string | undefined;
  orgName?: string | undefined;
}

/**
 * Auto-validation par le comité Faritany : en_cours → validee, sans passer par
 * le national. Les contrôles sont faits ici avant l'aller-retour réseau, pour
 * afficher un message utile plutôt qu'une erreur Postgres — mais la RLS et le
 * trigger `trg_garde_auto_validation` restent l'autorité.
 */
export async function autoValiderEvaluation(id: string, o: AutoValiderOptions): Promise<void> {
  const { data: cur, error: readErr } = await supabase
    .from('evaluations').select('statut').eq('id', id).single();
  if (readErr || !cur) throw new Error(`Évaluation introuvable : ${id}`);
  const statut = (cur as { statut: EvaluationStatut }).statut;

  const t = verifierTransition(statut, 'validee', {
    role: o.role, userOrgId: o.userOrgId, evalOrgId: o.evalOrgId,
  });
  if (!t.autorise) throw new Error(t.raison ?? 'Transition refusée.');

  const v = verifierAutoValidation({
    pvComitePath: o.pvComitePath,
    essentielsKO: o.essentielsKO,
    ...(o.confirmeMalgreEssentiels !== undefined
      ? { confirmeMalgreEssentiels: o.confirmeMalgreEssentiels } : {}),
  });
  if (!v.autorise) throw new Error(v.erreurs.join(' '));

  const valideeAt = new Date();
  const { error } = await supabase.from('evaluations').update({
    statut:            'validee',
    validee_par:       o.valideePar,
    validee_at:        valideeAt.toISOString(),
    pv_comite_path:    o.pvComitePath,
    revue_echeance_at: calculerEcheanceRevue(valideeAt, o.delaiRevueJours ?? 60).toISOString(),
  } as unknown as Database['public']['Tables']['evaluations']['Update']).eq('id', id);
  if (error) throw error;

  // Valider avec des essentiels non conformes est permis — jamais silencieux.
  if (o.essentielsKO.length > 0 && o.recipientId) {
    void createNotification({
      type: 'alerte_critique',
      title: 'Évaluation validée avec des critères essentiels non conformes',
      message: `${o.orgName ?? 'Un Faritany'} a validé son évaluation avec `
             + `${o.essentielsKO.length} critère(s) essentiel(s) à 0 : ${o.essentielsKO.join(', ')}.`,
      recipientId: o.recipientId,
      resourceType: 'evaluation', resourceId: id,
    }).catch(() => {});
  }
}

export interface RevueOptions {
  verdict: 'approved' | 'approved_with_conditions' | 'revision_requested';
  motif?: string | undefined;
  revuePar: string;
  role: UserRole;
  recipientId?: string | undefined;
  orgName?: string | undefined;
}

/**
 * Revue nationale a posteriori. Non bloquante : une évaluation non revue à
 * l'échéance est clôturée par le job `cloturer-evaluations-non-revues`.
 */
export async function revoirEvaluation(id: string, o: RevueOptions): Promise<void> {
  if (o.verdict === 'revision_requested' && !o.motif?.trim()) {
    throw new Error('Un renvoi en révision exige un motif.');
  }
  const cible: EvaluationStatut = o.verdict === 'revision_requested' ? 'en_cours' : 'cloturee';

  const { data: cur, error: readErr } = await supabase
    .from('evaluations').select('statut, org_id').eq('id', id).single();
  if (readErr || !cur) throw new Error(`Évaluation introuvable : ${id}`);
  const row = cur as { statut: EvaluationStatut; org_id: string };

  const t = verifierTransition(row.statut, cible, {
    role: o.role, userOrgId: row.org_id, evalOrgId: row.org_id,
  });
  if (!t.autorise) throw new Error(t.raison ?? 'Transition refusée.');

  const { error } = await supabase.from('evaluations').update({
    statut:           cible,
    reviewer_verdict: o.verdict,
    revue_par:        o.revuePar,
    revue_at:         new Date().toISOString(),
    revue_motif:      o.motif ?? null,
  } as unknown as Database['public']['Tables']['evaluations']['Update']).eq('id', id);
  if (error) throw error;

  if (o.recipientId) {
    void createNotification({
      type: o.verdict === 'revision_requested' ? 'evaluation_rejected' : 'evaluation_validated',
      title: o.verdict === 'revision_requested' ? 'Révision demandée' : 'Évaluation clôturée',
      message: o.verdict === 'revision_requested'
        ? `L'évaluation de ${o.orgName ?? 'votre organisation'} est renvoyée : ${o.motif ?? ''}`
        : `L'évaluation de ${o.orgName ?? 'votre organisation'} a été revue et clôturée.`,
      recipientId: o.recipientId,
      resourceType: 'evaluation', resourceId: id,
    }).catch(() => {});
  }
}
