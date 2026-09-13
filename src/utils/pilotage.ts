import type { ActionStatut, ActionPriorite } from '@/types';

export type StatutFaritany = 'non_evalue' | 'rien_demarre' | 'en_souffrance' | 'sous_controle';

export interface FaritanySignals {
  evalue: boolean;
  essentielsKoCount: number;
  actionsTotal: number;
  actionsRetard: number;
  actionsBloque: number;
}

/**
 * Statut décisionnel d'un Faritany. L'ordre des tests est intentionnel :
 * non évalué prime ; « KO + aucune action » (rien démarré) est distingué de
 * « sous contrôle » pour ne pas masquer le premier candidat à l'appui.
 */
export function deriverStatutFaritany(s: FaritanySignals): StatutFaritany {
  if (!s.evalue) return 'non_evalue';
  if (s.essentielsKoCount > 0 && s.actionsTotal === 0) return 'rien_demarre';
  if (s.actionsRetard > 0 || s.actionsBloque > 0) return 'en_souffrance';
  return 'sous_controle';
}

export interface Bucket2x2 {
  appuiUrgent: number;  // sévérité (KO) ET exécution en souffrance
  conformite: number;   // KO seul (inclut « rien démarré »)
  execution: number;    // souffrance seule
  sain: number;         // évalué, ni KO ni souffrance
  nonEvalue: number;
}

/** Répartit les Faritany sur 2 axes bruts (sévérité × exécution) ; non évalués à part. */
export function bucketiser2x2(rows: FaritanySignals[]): Bucket2x2 {
  const b: Bucket2x2 = { appuiUrgent: 0, conformite: 0, execution: 0, sain: 0, nonEvalue: 0 };
  for (const r of rows) {
    if (!r.evalue) { b.nonEvalue++; continue; }
    const severite = r.essentielsKoCount > 0;
    const souffrance = r.actionsRetard > 0 || r.actionsBloque > 0;
    if (severite && souffrance) b.appuiUrgent++;
    else if (severite) b.conformite++;
    else if (souffrance) b.execution++;
    else b.sain++;
  }
  return b;
}

export type PrioriteItem =
  | { kind: 'essentiel_ko'; code: string; libelle: string }
  | { kind: 'action'; id: string; titre: string; statut: ActionStatut; dateEcheance: string; priorite: ActionPriorite };

const RANG_PRIORITE: Record<ActionPriorite, number> = { critique: 0, haute: 1, moyenne: 2, basse: 3 };

/** Rang de bloc : KO (0) < action bloquée (1) < action en retard (2). */
function rangBloc(it: PrioriteItem): number {
  if (it.kind === 'essentiel_ko') return 0;
  return it.statut === 'bloque' ? 1 : 2;
}

/**
 * Ordonne la file régionale : essentiels KO → actions bloquées → actions en
 * retard (échéance la plus ancienne d\'abord) ; à bloc égal, priorité la plus
 * haute d\'abord. Ne filtre pas : l\'appelant ne passe que KO + actions en souffrance.
 */
export function ordonnerPrioritesRegionales(items: PrioriteItem[]): PrioriteItem[] {
  return [...items].sort((a, b) => {
    const ra = rangBloc(a), rb = rangBloc(b);
    if (ra !== rb) return ra - rb;
    if (a.kind === 'action' && b.kind === 'action') {
      if (a.statut !== 'bloque' && b.statut !== 'bloque') {
        // deux retards : échéance la plus ancienne d'abord
        if (a.dateEcheance !== b.dateEcheance) return a.dateEcheance < b.dateEcheance ? -1 : 1;
      }
      return RANG_PRIORITE[a.priorite] - RANG_PRIORITE[b.priorite];
    }
    return 0;
  });
}
