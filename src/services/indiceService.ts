import { supabase } from './supabase';
import { getReferentiel } from './referentielService';
import { getLibelleNiveauLocal } from './organisationService';
import {
  calculerIndiceDeploiement,
  type EvalFaritanyParticipante,
  type IndiceCritereNational,
} from './indice/calculerIndiceDeploiement';
import {
  calculerComparaisonFaritany,
  type OrgInfoFaritany,
} from './indice/calculerComparaisonFaritany';
import type { LigneAsn } from '@/utils/asnTableau';
import type { ScoreMap } from './scoring';
import type { Referentiel } from '@/types';

const VERSION_FAR = 'far_v1_0';
const VERSION_NAT = 'v3_0';

type Row = Record<string, unknown>;

interface DonneesIndice {
  refFar: Referentiel;
  evalsParticipantes: EvalFaritanyParticipante[];
  poids: Record<string, number>;
  notesNationales: Record<string, number | null>;
  orgInfo: Record<string, OrgInfoFaritany>;
  osnOrgIds: string[];
}

/**
 * Charge, une seule fois, tout le nécessaire à l'Indice de Déploiement (§6) —
 * côté Faritany (toutes campagnes far_v1_0, dédup dernière éval par org) et côté
 * national (auto-éval OSN v3_0, validée préférée). Lecture seule, sous le JWT de
 * l'utilisateur. Rend `null` s'il n'y a aucune donnée far exploitable.
 *
 * ⚠️ Schéma : `evaluations` n'a PAS de `referentiel_version` — la version vit sur
 * `campagnes`. On sélectionne donc toujours par campagne.
 */
async function chargerDonneesIndice(): Promise<DonneesIndice | null> {
  const refFar = await getReferentiel(VERSION_FAR);
  if (!refFar) return null;

  // ── Côté Faritany : toutes les campagnes far_v1_0 ──
  const { data: farCamps, error: eFC } = await supabase
    .from('campagnes').select('id').eq('referentiel_version', VERSION_FAR);
  if (eFC) throw eFC;
  const farCampIds = (farCamps ?? []).map((c) => (c as Row)['id'] as string);
  if (farCampIds.length === 0) return null;

  const { data: farEvalsRaw, error: eEv } = await supabase
    .from('evaluations').select('id, org_id, created_at')
    .in('campagne_id', farCampIds)
    .order('created_at', { ascending: false });
  if (eEv) throw eEv;
  const farEvals = (farEvalsRaw ?? []) as Row[];
  if (farEvals.length === 0) return null;

  // Dédup : dernière éval par org (liste déjà triée created_at desc → 1er vu = plus récent).
  const latestByOrg = new Map<string, string>(); // org_id -> eval_id
  for (const e of farEvals) {
    const org = e['org_id'] as string;
    if (!latestByOrg.has(org)) latestByOrg.set(org, e['id'] as string);
  }
  const candidateEvalIds = [...latestByOrg.values()];
  const orgIds = [...latestByOrg.keys()];

  const { data: orgsRaw, error: eOrg } = await supabase
    .from('organisations').select('id, poids, parent_id, nom, code').in('id', orgIds);
  if (eOrg) throw eOrg;
  const poids: Record<string, number> = {};
  const orgInfo: Record<string, OrgInfoFaritany> = {};
  for (const o of (orgsRaw ?? []) as Row[]) {
    const id = o['id'] as string;
    poids[id] = (o['poids'] as number | null) ?? 1;
    orgInfo[id] = {
      nom: (o['nom'] as string | null) ?? id,
      code: (o['code'] as string | null) ?? undefined,
    };
  }
  // OSN(s) = parent(s) distinct(s) et non nul(s) des Faritany participantes.
  // Le référentiel v3_0 est mondial (tous les OSN) → l'éval nationale DOIT être
  // scopée à l'OSN propriétaire des Faritany, sinon on peut piocher l'éval
  // d'un autre pays (RLS admin_global non scopée).
  const osnOrgIds = [...new Set(
    (orgsRaw ?? []).map((o) => (o as Row)['parent_id']).filter((p): p is string => typeof p === 'string'),
  )];

  const { data: scoresRaw, error: eSc } = await supabase
    .from('evaluation_scores').select('eval_id, critere_code, note')
    .in('eval_id', candidateEvalIds);
  if (eSc) throw eSc;
  const scoresParEval = new Map<string, ScoreMap>();
  for (const r of (scoresRaw ?? []) as Row[]) {
    const id = r['eval_id'] as string;
    const map = scoresParEval.get(id) ?? {};
    map[r['critere_code'] as string] = r['note'] as number | null;
    scoresParEval.set(id, map);
  }
  // Participantes = évals dédupliquées ayant ≥1 score.
  const evalsParticipantes: EvalFaritanyParticipante[] = [];
  for (const [org, evalId] of latestByOrg) {
    const scores = scoresParEval.get(evalId);
    if (scores) evalsParticipantes.push({ orgId: org, scores });
  }

  // ── Côté national : auto-éval OSN v3_0 (via campagne), validée préférée ──
  const notesNationales: Record<string, number | null> = {};
  const { data: natCamps, error: eNC } = await supabase
    .from('campagnes').select('id').eq('referentiel_version', VERSION_NAT);
  if (eNC) throw eNC;
  const natCampIds = (natCamps ?? []).map((c) => (c as Row)['id'] as string);
  if (natCampIds.length > 0 && osnOrgIds.length > 0) {
    const { data: natEvalsRaw, error: eNE } = await supabase
      .from('evaluations').select('id, statut, created_at, org_id')
      .in('campagne_id', natCampIds)
      .in('org_id', osnOrgIds)
      .order('created_at', { ascending: false });
    if (eNE) throw eNE;
    const natEvals = (natEvalsRaw ?? []) as Row[];
    // Validée préférée, sinon la plus récente (liste triée created_at desc).
    const natEval = natEvals.find((e) => e['statut'] === 'validee') ?? natEvals[0];
    if (natEval) {
      const { data: natScores, error: eNS } = await supabase
        .from('evaluation_scores').select('critere_code, note')
        .eq('eval_id', natEval['id'] as string);
      if (eNS) throw eNS;
      for (const r of (natScores ?? []) as Row[]) {
        notesNationales[r['critere_code'] as string] = r['note'] as number | null;
      }
    }
  }

  return { refFar, evalsParticipantes, poids, notesNationales, orgInfo, osnOrgIds };
}

/**
 * Indice de Déploiement (§6) — table nationale par critère. Réservé côté route/UI
 * à admin_global | responsable_osn | responsable_region. Ne modifie jamais le
 * score GSAT.
 */
export async function getIndiceDeploiement(): Promise<IndiceCritereNational[]> {
  const d = await chargerDonneesIndice();
  if (!d) return [];
  return calculerIndiceDeploiement(d.refFar, d.evalsParticipantes, d.poids, d.notesNationales);
}

/**
 * Indice de Déploiement complet : table nationale par critère + comparaison par
 * Faritany (lentille ID), dérivées du MÊME jeu d'évals (un seul chargement) pour
 * rester cohérentes. Lecture seule, sous le JWT utilisateur.
 */
export async function getIndiceComplet(): Promise<{
  national: IndiceCritereNational[];
  faritany: LigneAsn[];
  dimensionCodes: string[];
  niveauLabel: string | null;
}> {
  const d = await chargerDonneesIndice();
  if (!d) return { national: [], faritany: [], dimensionCodes: [], niveauLabel: null };
  // Libellé du niveau local (ex. « Faritany ») depuis system_config de l'OSN
  // parente — jamais codé en dur. Multi-OSN (admin) → premier disponible.
  const niveauLabel = d.osnOrgIds[0] ? await getLibelleNiveauLocal(d.osnOrgIds[0]) : null;
  return {
    national: calculerIndiceDeploiement(d.refFar, d.evalsParticipantes, d.poids, d.notesNationales),
    faritany: calculerComparaisonFaritany(d.refFar, d.evalsParticipantes, d.orgInfo),
    dimensionCodes: d.refFar.dimensions.map((dim) => dim.code),
    niveauLabel,
  };
}
