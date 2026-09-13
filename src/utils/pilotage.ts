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
