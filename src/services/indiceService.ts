import { supabase } from './supabase';
import { getReferentiel } from './referentielService';
import {
  calculerIndiceDeploiement,
  type EvalFaritanyParticipante,
  type IndiceCritereNational,
} from './indice/calculerIndiceDeploiement';
import type { ScoreMap } from './scoring';

const VERSION_FAR = 'far_v1_0';
const VERSION_NAT = 'v3_0';

type Row = Record<string, unknown>;

/**
 * Indice de Déploiement (§6) — lecture seule, sous le JWT de l'utilisateur.
 * Réservé côté route/UI à admin_global | responsable_osn | responsable_region :
 * ces rôles lisent l'éval nationale et les évals des Faritany descendants sans
 * SECURITY DEFINER. Ne modifie jamais le score GSAT.
 */
export async function getIndiceDeploiement(): Promise<IndiceCritereNational[]> {
  const refFar = await getReferentiel(VERSION_FAR);
  if (!refFar) return [];

  // 1. Campagne far la plus récente.
  const { data: camps, error: eCamp } = await supabase
    .from('campagnes').select('id, date_ouverture')
    .eq('referentiel_version', VERSION_FAR)
    .order('date_ouverture', { ascending: false });
  if (eCamp) throw eCamp;
  const campFar = (camps ?? [])[0] as Row | undefined;
  if (!campFar) return [];

  // 2. Évals far de cette campagne + poids des orgs.
  const { data: evalsFarRaw, error: eEv } = await supabase
    .from('evaluations').select('id, org_id')
    .eq('campagne_id', campFar['id'] as string);
  if (eEv) throw eEv;
  const evalsFar = (evalsFarRaw ?? []) as Row[];
  if (evalsFar.length === 0) return [];

  const orgIds = [...new Set(evalsFar.map((e) => e['org_id'] as string))];
  const { data: orgsRaw, error: eOrg } = await supabase
    .from('organisations').select('id, poids').in('id', orgIds);
  if (eOrg) throw eOrg;
  const poids: Record<string, number> = {};
  for (const o of (orgsRaw ?? []) as Row[]) poids[o['id'] as string] = (o['poids'] as number | null) ?? 1;

  // 3. Scores far en batch (un seul appel).
  const evalIds = evalsFar.map((e) => e['id'] as string);
  const { data: scoresRaw, error: eSc } = await supabase
    .from('evaluation_scores').select('eval_id, critere_code, note')
    .in('eval_id', evalIds);
  if (eSc) throw eSc;
  const scoresParEval = new Map<string, ScoreMap>();
  for (const r of (scoresRaw ?? []) as Row[]) {
    const evalId = r['eval_id'] as string;
    const map = scoresParEval.get(evalId) ?? {};
    map[r['critere_code'] as string] = (r['note'] as number | null);
    scoresParEval.set(evalId, map);
  }
  // Participantes = évals qui ont au moins un score.
  const evalsParticipantes: EvalFaritanyParticipante[] = evalsFar
    .filter((e) => scoresParEval.has(e['id'] as string))
    .map((e) => ({ orgId: e['org_id'] as string, scores: scoresParEval.get(e['id'] as string) as ScoreMap }));

  // 4. Éval nationale v3_0 → notes par critère.
  const notesNationales: Record<string, number | null> = {};
  const { data: evalNat, error: eNat } = await supabase
    .from('evaluations').select('id')
    .eq('referentiel_version', VERSION_NAT)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (eNat) throw eNat;
  if (evalNat) {
    const { data: natScores, error: eNs } = await supabase
      .from('evaluation_scores').select('critere_code, note')
      .eq('eval_id', (evalNat as Row)['id'] as string);
    if (eNs) throw eNs;
    for (const r of (natScores ?? []) as Row[]) {
      notesNationales[r['critere_code'] as string] = (r['note'] as number | null);
    }
  }

  return calculerIndiceDeploiement(refFar, evalsParticipantes, poids, notesNationales);
}
