import { supabase } from './supabase';
import type { Alerte, AlerteType, AlerteSeverite, AlerteStatut } from '@/types';

/** Ordre d'affichage : la plus grave d'abord. */
const RANG_SEVERITE: Record<AlerteSeverite, number> = { critique: 0, vigilance: 1, info: 2 };

function rowToAlerte(row: Record<string, unknown>): Alerte {
  const detail = row['detail'] as string | null | undefined;
  const critereCode = row['critere_code'] as string | null | undefined;
  return {
    id: row['id'] as string,
    orgId: row['org_id'] as string,
    type: row['type'] as AlerteType,
    severite: row['severite'] as AlerteSeverite,
    titre: row['titre'] as string,
    statut: row['statut'] as AlerteStatut,
    createdAt: row['created_at'] as string,
    ...(detail ? { detail } : {}),
    ...(critereCode ? { critereCode } : {}),
  };
}

/**
 * Tri d'affichage (logique pure, testable) : par sévérité décroissante puis
 * récence, plafonné à `limite`. Au plus 5 alertes ouvertes par organisation
 * (cf. commentaire de la table `alertes`).
 */
export function trierAlertes(alertes: Alerte[], limite = 5): Alerte[] {
  return [...alertes]
    .sort((a, b) =>
      RANG_SEVERITE[a.severite] - RANG_SEVERITE[b.severite] ||
      b.createdAt.localeCompare(a.createdAt),
    )
    .slice(0, limite);
}

/** Alertes OUVERTES d'une organisation, triées par sévérité, plafonnées à 5. */
export async function listAlertesOuvertes(orgId: string, limite = 5): Promise<Alerte[]> {
  const { data, error } = await supabase
    .from('alertes')
    .select('id, org_id, type, severite, titre, detail, critere_code, statut, created_at')
    .eq('org_id', orgId)
    .eq('statut', 'ouverte');
  if (error) throw error;
  return trierAlertes((data ?? []).map(r => rowToAlerte(r as Record<string, unknown>)), limite);
}
