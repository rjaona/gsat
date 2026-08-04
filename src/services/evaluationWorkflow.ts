/**
 * Machine à états des évaluations — logique pure, testable sans Supabase.
 *
 * Deux chemins coexistent depuis l'arbitrage du 4 août 2026 :
 *
 *   ÉVALUATION ACCOMPAGNÉE (national)
 *     brouillon → en_cours → soumise → validee → cloturee
 *                              ↑          │
 *                              └──────────┘  (révision demandée)
 *
 *   AUTO-VALIDATION FARITANY (responsable_asn)
 *     brouillon → en_cours ──────────────→ validee → cloturee
 *                    ↑                        │        ↑
 *                    └────────────────────────┘        │
 *                        (révision demandée)     (revue OK, ou échéance
 *                                                 dépassée → clôture auto)
 */

import type { EvaluationStatut, UserRole } from '@/types';

const TRANSITIONS: Record<EvaluationStatut, EvaluationStatut[]> = {
  brouillon: ['en_cours'],
  // 'validee' : auto-validation Faritany, sans passer par 'soumise'
  en_cours:  ['soumise', 'validee'],
  soumise:   ['validee', 'en_cours'],
  // 'en_cours' : renvoi en révision par la revue nationale
  validee:   ['cloturee', 'en_cours'],
  cloturee:  [],
};

/** Qui a le droit de poser ce statut. */
const ROLES_AUTORISES: Record<EvaluationStatut, UserRole[]> = {
  brouillon: ['admin_global', 'responsable_osn', 'responsable_asn', 'utilisateur_asn', 'evaluateur'],
  en_cours:  ['admin_global', 'responsable_osn', 'responsable_asn', 'utilisateur_asn', 'evaluateur'],
  soumise:   ['admin_global', 'responsable_osn', 'responsable_asn', 'utilisateur_asn', 'evaluateur'],
  // Le comité Faritany peut valider — mais seulement sa propre évaluation (voir estAutorise).
  validee:   ['admin_global', 'responsable_osn', 'responsable_asn', 'evaluateur'],
  // La clôture reste au national ou au job de clôture automatique.
  cloturee:  ['admin_global', 'responsable_osn'],
};

export function canTransitionTo(current: EvaluationStatut, next: EvaluationStatut): boolean {
  return TRANSITIONS[current].includes(next);
}

export interface ContexteTransition {
  role: UserRole;
  /** org de l'utilisateur */
  userOrgId: string;
  /** org propriétaire de l'évaluation */
  evalOrgId: string;
}

export interface VerdictTransition {
  autorise: boolean;
  /** Motif du refus, formulé pour l'utilisateur. */
  raison?: string;
}

/**
 * Une transition est autorisée si (1) la machine à états la permet,
 * (2) le rôle y a droit, (3) le périmètre est respecté.
 *
 * Le point 3 est le garde-fou de l'auto-validation : un responsable_asn ne
 * touche QUE son organisation. La RLS le rejetterait de toute façon — ce
 * contrôle sert à afficher un message utile plutôt qu'une erreur Postgres.
 */
export function verifierTransition(
  current: EvaluationStatut,
  next: EvaluationStatut,
  ctx: ContexteTransition,
): VerdictTransition {
  if (!canTransitionTo(current, next)) {
    return { autorise: false, raison: `Transition impossible : « ${current} » → « ${next} ».` };
  }
  if (!ROLES_AUTORISES[next].includes(ctx.role)) {
    return { autorise: false, raison: `Votre rôle ne permet pas de passer une évaluation en « ${next} ».` };
  }
  const perimetreLocal: UserRole[] = ['responsable_asn', 'utilisateur_asn'];
  if (perimetreLocal.includes(ctx.role) && ctx.userOrgId !== ctx.evalOrgId) {
    return { autorise: false, raison: "Cette évaluation appartient à une autre organisation." };
  }
  return { autorise: true };
}

export interface PreconditionsAutoValidation {
  pvComitePath?: string | null | undefined;
  essentielsKO: string[];
  /** L'utilisateur a explicitement confirmé malgré des essentiels non conformes. */
  confirmeMalgreEssentiels?: boolean;
}

export interface VerdictAutoValidation {
  autorise: boolean;
  /** Bloque la validation. */
  erreurs: string[];
  /** N'empêche pas de valider, mais doit être affiché et confirmé. */
  avertissements: string[];
}

/**
 * Un comité peut valider AVEC des essentiels non conformes — on ne pousse
 * personne à masquer un problème. Mais il doit le voir et le confirmer, et la
 * validation déclenchera une alerte critique côté national.
 *
 * Le PV de comité, lui, est bloquant : c'est la seule trace qui rend
 * l'auto-validation défendable. Le trigger SQL le rejette aussi — ici on évite
 * juste un aller-retour réseau et une erreur Postgres illisible.
 */
export function verifierAutoValidation(p: PreconditionsAutoValidation): VerdictAutoValidation {
  const erreurs: string[] = [];
  const avertissements: string[] = [];

  if (!p.pvComitePath || p.pvComitePath.trim() === '') {
    erreurs.push("Le procès-verbal du comité ayant approuvé l'évaluation est obligatoire.");
  }
  if (p.essentielsKO.length > 0) {
    const liste = p.essentielsKO.join(', ');
    avertissements.push(
      `${p.essentielsKO.length} critère(s) essentiel(s) non conforme(s) : ${liste}. ` +
      `La validation reste possible, mais le niveau national en sera informé.`,
    );
    if (!p.confirmeMalgreEssentiels) {
      erreurs.push('Confirmez explicitement la validation malgré les critères essentiels non conformes.');
    }
  }
  return { autorise: erreurs.length === 0, erreurs, avertissements };
}

/** Échéance de revue = date de validation + délai configuré (60 j par défaut). */
export function calculerEcheanceRevue(valideeAt: Date, delaiJours = 60): Date {
  const d = new Date(valideeAt.getTime());
  d.setDate(d.getDate() + delaiJours);
  return d;
}

export type UrgenceRevue = 'depassee' | 'imminente' | 'normale';

/** Jours restants avant clôture automatique, et niveau d'urgence associé. */
export function statutRevue(
  echeance: Date | null,
  maintenant: Date,
): { joursRestants: number | null; urgence: UrgenceRevue } {
  if (!echeance) return { joursRestants: null, urgence: 'normale' };
  const ms = echeance.getTime() - maintenant.getTime();
  const jours = Math.ceil(ms / 86_400_000);
  if (jours < 0) return { joursRestants: jours, urgence: 'depassee' };
  if (jours <= 7) return { joursRestants: jours, urgence: 'imminente' };
  return { joursRestants: jours, urgence: 'normale' };
}

/**
 * Score de risque servant à ordonner la file de revue nationale.
 * À 33 Faritany, le national ne relit pas tout : il relit d'abord ce qui
 * cumule les signaux. Plus le score est haut, plus la relecture est prioritaire.
 */
export interface SignauxRisque {
  nbEssentielsKO: number;
  /** Écarts note déclarée ↔ indicateur ERP (|écart| ≥ 2). */
  nbIncoherences: number;
  nbAlertesCritiques: number;
  /** Progression du score vs cycle précédent, en points. */
  progressionPoints?: number | null;
  joursAvantEcheance?: number | null;
}

export function scoreRisqueRevue(s: SignauxRisque): number {
  let score = 0;
  score += s.nbEssentielsKO * 10;
  score += s.nbIncoherences * 8;
  score += s.nbAlertesCritiques * 5;
  // Une progression spectaculaire est un signal, pas une bonne nouvelle en soi.
  if (typeof s.progressionPoints === 'number' && s.progressionPoints > 20) {
    score += Math.min(20, Math.round(s.progressionPoints / 2));
  }
  // L'échéance qui approche remonte la priorité, sans écraser le reste.
  if (typeof s.joursAvantEcheance === 'number') {
    if (s.joursAvantEcheance < 0) score += 15;
    else if (s.joursAvantEcheance <= 7) score += 10;
    else if (s.joursAvantEcheance <= 15) score += 5;
  }
  return score;
}
