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
