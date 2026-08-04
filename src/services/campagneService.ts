import { supabase } from './supabase';
import type { Campagne, CampagneStatut, CampagneMode } from '@/types';
import type { Database } from '@/types/supabase.generated';
import { createNotification } from './notificationService';
import { writeAuditEntry } from './auditService';

// ── Transitions de statut autorisées ─────────────────────────────────────────

const CAMPAGNE_TRANSITIONS: Record<CampagneStatut, CampagneStatut[]> = {
  planifiee: ['ouverte'],
  ouverte:   ['fermee'],
  fermee:    ['archivee'],
  archivee:  [],
};

export function canCampagneTransitionTo(
  current: CampagneStatut,
  next: CampagneStatut
): boolean {
  return CAMPAGNE_TRANSITIONS[current]?.includes(next) ?? false;
}

// ── Conversion DB ↔ type applicatif ──────────────────────────────────────────

function rowToCampagne(row: Record<string, unknown>): Campagne {
  return {
    id:                  row['id']                  as string,
    organisateurId:      row['organisateur_id']     as string,
    referentielVersion:  row['referentiel_version'] as string,
    nom:                 row['nom']                 as string,
    description:         row['description']         as string | undefined,
    dateOuverture:       row['date_ouverture']      as string,
    dateFermeture:       row['date_fermeture']      as string,
    statut:              row['statut']              as CampagneStatut,
    mode:                (row['mode'] as CampagneMode | null) ?? 'complet',
    perimetre:           (row['perimetre'] ?? [])   as string[],
    createdBy:           row['created_by']          as string,
    createdAt:           row['created_at']          as string,
    evaluateurId:        row['evaluateur_id']       as string | undefined,
    evaluateurName:      row['evaluateur_name']     as string | undefined,
    reviewerId:          row['reviewer_id']         as string | undefined,
    reviewerName:        row['reviewer_name']       as string | undefined,
    approbateurId:       row['approbateur_id']      as string | undefined,
    approbateurName:     row['approbateur_name']    as string | undefined,
  };
}

// ── Lecture ponctuelle ────────────────────────────────────────────────────────

export async function getCampagne(id: string): Promise<Campagne | null> {
  const { data, error } = await supabase
    .from('campagnes')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return rowToCampagne(data as Record<string, unknown>);
}

export async function listCampagnes(filtreStatut?: CampagneStatut): Promise<Campagne[]> {
  let q = supabase.from('campagnes').select('*').order('date_ouverture', { ascending: false });
  if (filtreStatut) q = q.eq('statut', filtreStatut);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(r => rowToCampagne(r as Record<string, unknown>));
}

// ── Abonnement temps réel ─────────────────────────────────────────────────────

export function subscribeCampagnes(
  onData: (campagnes: Campagne[]) => void,
  onError?: (err: Error) => void,
  filtreStatut?: CampagneStatut
): () => void {
  void listCampagnes(filtreStatut).then(onData).catch(onError);

  const channel = supabase
    .channel('campagnes-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'campagnes' }, () => {
      void listCampagnes(filtreStatut).then(onData).catch(onError);
    })
    .subscribe();

  return () => { void supabase.removeChannel(channel); };
}

export function subscribeCampagnesOrganisateur(
  organisateurId: string,
  onData: (campagnes: Campagne[]) => void,
  onError?: (err: Error) => void
): () => void {
  const fetch = () =>
    supabase
      .from('campagnes')
      .select('*')
      .eq('organisateur_id', organisateurId)
      .order('date_ouverture', { ascending: false })
      .then(({ data, error }) => {
        if (error) { onError?.(error); return; }
        onData((data ?? []).map(r => rowToCampagne(r as Record<string, unknown>)));
      });

  void fetch();

  const channel = supabase
    .channel(`campagnes-organisateur-${organisateurId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'campagnes',
      filter: `organisateur_id=eq.${organisateurId}`,
    }, () => void fetch())
    .subscribe();

  return () => { void supabase.removeChannel(channel); };
}

// ── Écriture ──────────────────────────────────────────────────────────────────

export type CampagnePayload = Omit<Campagne, 'id' | 'createdAt'>;

export interface CreateCampagneOptions {
  recipientId?: string | undefined;
  creatorName?: string | undefined;
}

export async function createCampagne(
  payload: CampagnePayload,
  createdBy: string,
  options?: CreateCampagneOptions,
): Promise<string> {
  const { data, error } = await supabase
    .from('campagnes')
    .insert({
      organisateur_id:    payload.organisateurId,
      referentiel_version: payload.referentielVersion,
      nom:                payload.nom,
      description:        payload.description ?? null,
      date_ouverture:     payload.dateOuverture,
      date_fermeture:     payload.dateFermeture,
      statut:             payload.statut,
      perimetre:          payload.perimetre,
      evaluateur_id:      payload.evaluateurId  ?? null,
      evaluateur_name:    payload.evaluateurName ?? null,
      reviewer_id:        payload.reviewerId    ?? null,
      reviewer_name:      payload.reviewerName  ?? null,
      approbateur_id:     payload.approbateurId ?? null,
      approbateur_name:   payload.approbateurName ?? null,
      created_by:         createdBy,
    })
    .select('id')
    .single();
  if (error) throw error;

  const id = (data as { id: string }).id;

  void writeAuditEntry({
    userId:     createdBy,
    userEmail:  createdBy,
    action:     'create',
    resource:   'campagne',
    resourceId: id,
    metadata:   { nom: payload.nom, statut: payload.statut },
  });

  if (options?.recipientId) {
    void createNotification({
      type:         'campagne_opened',
      title:        'Nouvelle campagne créée',
      message:      `La campagne "${payload.nom}" a été créée et est en attente d'ouverture.`,
      recipientId:  options.recipientId,
      senderId:     createdBy,
      senderName:   options.creatorName,
      resourceType: 'campagne',
      resourceId:   id,
    }).catch(() => {});
  }

  return id;
}

export async function updateCampagne(
  id: string,
  data: Partial<Omit<Campagne, 'id' | 'createdAt' | 'createdBy'>>
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (data.nom               !== undefined) row['nom']                 = data.nom;
  if (data.description       !== undefined) row['description']         = data.description ?? null;
  if (data.dateOuverture     !== undefined) row['date_ouverture']      = data.dateOuverture;
  if (data.dateFermeture     !== undefined) row['date_fermeture']      = data.dateFermeture;
  if (data.statut            !== undefined) row['statut']              = data.statut;
  if (data.perimetre         !== undefined) row['perimetre']           = data.perimetre;
  if (data.evaluateurId      !== undefined) row['evaluateur_id']       = data.evaluateurId ?? null;
  if (data.evaluateurName    !== undefined) row['evaluateur_name']     = data.evaluateurName ?? null;
  if (data.reviewerId        !== undefined) row['reviewer_id']         = data.reviewerId ?? null;
  if (data.reviewerName      !== undefined) row['reviewer_name']       = data.reviewerName ?? null;
  if (data.approbateurId     !== undefined) row['approbateur_id']      = data.approbateurId ?? null;
  if (data.approbateurName   !== undefined) row['approbateur_name']    = data.approbateurName ?? null;

  const { error } = await supabase.from('campagnes').update(row as unknown as Database['public']['Tables']['campagnes']['Update']).eq('id', id);
  if (error) throw error;
}

export async function updateStatutCampagne(
  id: string,
  statut: CampagneStatut,
  options?: {
    actorId?:      string | undefined;
    actorName?:    string | undefined;
    recipientIds?: string[] | undefined;
    campagneName?: string | undefined;
  },
): Promise<void> {
  // Lire le statut actuel pour valider la transition
  const { data: current, error: readErr } = await supabase
    .from('campagnes')
    .select('statut')
    .eq('id', id)
    .single();
  if (readErr || !current) throw new Error(`Campagne introuvable : ${id}`);

  const statutActuel = (current as { statut: CampagneStatut }).statut;
  if (!canCampagneTransitionTo(statutActuel, statut)) {
    throw new Error(
      `Transition invalide : "${statutActuel}" → "${statut}". Transitions autorisées depuis "${statutActuel}" : [${CAMPAGNE_TRANSITIONS[statutActuel].join(', ') || 'aucune'}].`
    );
  }

  const { error } = await supabase.from('campagnes').update({ statut }).eq('id', id);
  if (error) throw error;

  const { actorId, actorName, recipientIds = [], campagneName = 'une campagne' } = options ?? {};

  void writeAuditEntry({
    userId:     actorId ?? 'unknown',
    userEmail:  actorId ?? 'unknown',
    action:     statut === 'fermee' ? 'close' : 'update',
    resource:   'campagne',
    resourceId: id,
    metadata:   { statutPrecedent: statutActuel, nouveauStatut: statut, nom: campagneName },
  });

  if (statut === 'ouverte' && recipientIds.length > 0) {
    await Promise.allSettled(recipientIds.map(recipientId =>
      createNotification({
        type: 'campagne_opened', title: 'Campagne ouverte',
        message: `La campagne "${campagneName}" est maintenant ouverte. Les évaluations peuvent commencer.`,
        recipientId, senderId: actorId, senderName: actorName,
        resourceType: 'campagne', resourceId: id,
      })
    ));
  }

  if (statut === 'fermee' && recipientIds.length > 0) {
    await Promise.allSettled(recipientIds.map(recipientId =>
      createNotification({
        type: 'campagne_closed', title: 'Campagne fermée',
        message: `La campagne "${campagneName}" a été fermée. Les évaluations ne sont plus acceptées.`,
        recipientId, senderId: actorId, senderName: actorName,
        resourceType: 'campagne', resourceId: id,
      })
    ));
  }
}

export async function deleteCampagne(id: string): Promise<void> {
  const { count } = await supabase
    .from('evaluations')
    .select('id', { count: 'exact', head: true })
    .eq('campagne_id', id);

  if ((count ?? 0) > 0) {
    throw new Error(`Impossible de supprimer la campagne : ${count} évaluation(s) y sont liées.`);
  }

  const { error } = await supabase.from('campagnes').delete().eq('id', id);
  if (error) throw error;

  void writeAuditEntry({
    userId:    id,
    userEmail: id,
    action:    'delete',
    resource:  'campagne',
    resourceId: id,
  });
}

// ── Helpers métier ────────────────────────────────────────────────────────────

export async function getCampagneActiveForOrg(orgId: string): Promise<Campagne | null> {
  const { data, error } = await supabase
    .from('campagnes')
    .select('*')
    .eq('statut', 'ouverte')
    .order('date_ouverture', { ascending: false });

  if (error) throw error;

  const campagnes = (data ?? []).map(r => rowToCampagne(r as Record<string, unknown>));
  return campagnes.find(c => c.perimetre.length === 0 || c.perimetre.includes(orgId)) ?? null;
}

export function isCampagneExpiree(campagne: Campagne): boolean {
  return new Date(campagne.dateFermeture) < new Date();
}
