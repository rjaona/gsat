import { supabase } from './supabase';

/**
 * Snapshot ERP courant d'une organisation. `indicateurs` est une map libre
 * clé → valeur (le catalogue d'indicateurs bougera ; JSONB délibéré côté DB).
 * L'outil INFORME, il ne juge pas : aucune couleur, aucun seuil ici.
 */
export interface ErpSnapshot {
  orgId: string;
  periode: string;   // date ISO du 1er du mois de référence
  indicateurs: Record<string, number | string>;
}

/** Dernier snapshot ERP connu pour une organisation, ou null si aucun. */
export async function getErpSnapshotCourant(orgId: string): Promise<ErpSnapshot | null> {
  const { data, error } = await supabase
    .from('v_erp_snapshot_courant')
    .select('org_id, periode, indicateurs')
    .eq('org_id', orgId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  return {
    orgId: row['org_id'] as string,
    periode: row['periode'] as string,
    indicateurs: (row['indicateurs'] as Record<string, number | string> | null) ?? {},
  };
}
