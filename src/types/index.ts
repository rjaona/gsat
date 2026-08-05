// ── Organisations ─────────────────────────────────────────────────────────────

export type OrgType = 'OMMS' | 'REGION' | 'OSN' | 'ASN';

export type RegionCode =
  | 'AFRICA'
  | 'ASIA_PACIFIC'
  | 'ARAB'
  | 'INTERAMERICA'
  | 'EUROPE'
  | 'EURASIA';

export interface Coordonnees {
  lat: number;
  lng: number;
}

export interface Organisation {
  id: string;
  type: OrgType;
  nom: string;
  code?: string;           // ex: 'TEM'
  parentId?: string;
  paysId?: string;         // pour OSN
  regionCode?: RegionCode; // pour OSN et REGION
  actif: boolean;
  coordonnees?: Coordonnees; // lat/lng pour le marqueur cartographique (OSN)
  /** Pondération de consolidation (typiquement l'effectif). 1 = moyenne simple. */
  poids: number;
}

export interface Pays {
  id: string;
  codeIso: string;         // ISO 3166-1 alpha-2
  nom: I18nText;
  regionCode: RegionCode;
  actif: boolean;
}

// ── Auth / Utilisateurs ───────────────────────────────────────────────────────

export type UserRole =
  | 'admin_global'
  | 'responsable_region'
  | 'responsable_osn'
  | 'responsable_asn'   // comité Faritany — auto-valide SA PROPRE évaluation
  | 'utilisateur_asn'
  | 'evaluateur'
  | 'lecteur';

export interface UserProfile {
  id: string;          // = auth.uid
  orgId: string;
  orgType: OrgType;
  parentOrgId?: string;
  nom: string;
  prenom: string;
  email: string;
  role: UserRole;
  actif: boolean;
  createdAt: string;
}

// ── Référentiel ───────────────────────────────────────────────────────────────

export interface I18nText {
  fr: string;
  en: string;
  mg?: string;   // malgache — langue de travail des Faritany
}

export interface CritereDef {
  code: string;         // ex: '101', '217' (GSAT) ou 'F101', 'F217' (Faritany)
  libelle: I18nText;
  guideInterpretation?: I18nText;
  essentiel: boolean;
  actif: boolean;
  ordre: number;
  /** Codes des critères du référentiel parent dont celui-ci dérive. Base de l'Indice de Déploiement. */
  sourceCodes: string[];
  /** false = critère d'extension : saisissable, mais hors score en mode campagne 'socle'. */
  socle: boolean;
  /** Clés d'indicateurs ERP éclairant ce critère. Vide = pas de croisement possible. */
  indicateurErp: string[];
}

export interface DimensionDef {
  code: string;         // D01 ... D10
  nom: I18nText;
  ordre: number;
  criteres: CritereDef[];
}

/** Rendu par calculerScoreDimension : null = dimension non comptable (vide ou entièrement N/A). */
export type ScoreDimension = number | null;

export interface Referentiel {
  version: string;      // 'v3_0' (GSAT national) | 'far_v1_0' (GSAT-Faritany)
  nom: I18nText;
  actif: boolean;
  dimensions: DimensionDef[];
  /** Niveau d'organisation visé. 'OSN' = GSAT national, 'ASN' = GSAT-Faritany. */
  niveau?: OrgType | undefined;
  /** Version du référentiel dont celui-ci dérive. 'v3_0' pour far_v1_0. */
  parentVersion?: string | undefined;
}

// ── Campagnes ─────────────────────────────────────────────────────────────────

export type CampagneStatut = 'planifiee' | 'ouverte' | 'fermee' | 'archivee';

/** socle = seuls les critères socle=true entrent dans le score. Cycle 1 Faritany = 'socle'. */
export type CampagneMode = 'socle' | 'complet';

export interface Campagne {
  id: string;
  organisateurId: string;
  referentielVersion: string;
  nom: string;
  description?: string | undefined;
  dateOuverture: string;
  dateFermeture: string;
  statut: CampagneStatut;
  mode: CampagneMode;
  perimetre: string[];   // orgIds ciblés (vide = toutes ASN)
  createdBy: string;
  createdAt: string;
  // Workflow assignments
  evaluateurId?: string | undefined;
  evaluateurName?: string | undefined;
  reviewerId?: string | undefined;
  reviewerName?: string | undefined;
  approbateurId?: string | undefined;
  approbateurName?: string | undefined;
}

// ── Évaluations ───────────────────────────────────────────────────────────────

export type EvaluationStatut =
  | 'brouillon'
  | 'en_cours'
  | 'soumise'
  | 'validee'
  | 'cloturee';

export type EvaluationType = 'auto' | 'accompagnee';

export interface Evaluation {
  id: string;
  campagneId: string;
  orgId: string;
  type: EvaluationType;
  statut: EvaluationStatut;
  scoreGlobal?: number | undefined;
  scoreParDimension?: Record<string, number> | undefined;
  submittedBy?: string | undefined;
  submittedAt?: string | undefined;
  reviewerName?: string | undefined;
  reviewerTitle?: string | undefined;
  reviewerAvatar?: string | undefined;
  reviewerRecommendation?: string | undefined;
  reviewerVerdict?: 'approved' | 'approved_with_conditions' | 'revision_requested' | undefined;
  // ── Auto-validation Faritany + revue nationale a posteriori ────────────────
  valideePar?: string | undefined;
  valideeAt?: string | undefined;
  /** PV du comité ayant approuvé — obligatoire pour auto-valider (garde-fou SQL). */
  pvComitePath?: string | undefined;
  /** validee_at + system_config.revue_delai_jours. Passé cette date : clôture auto. */
  revueEcheanceAt?: string | undefined;
  revuePar?: string | undefined;
  revueAt?: string | undefined;
  /** Obligatoire si reviewerVerdict = 'revision_requested'. */
  revueMotif?: string | undefined;
  clotureeAuto: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Score {
  critereCode: string;
  note: 0 | 1 | 2 | 3 | null;
  commentaire?: string;
  updatedBy: string;
  updatedAt: string;
}

export interface Preuve {
  id: string;
  evalId: string;
  critereCode: string;
  storagePath: string;
  nom: string;
  typeMime: string;
  taille: number;
  uploadedBy: string;
  uploadedAt: string;
}

// ── Plans d'action ────────────────────────────────────────────────────────────

export type PlanStatut = 'brouillon' | 'actif' | 'cloture';
export type ActionStatut = 'a_faire' | 'en_cours' | 'termine' | 'bloque';
export type ActionPriorite = 'basse' | 'moyenne' | 'haute' | 'critique';

export interface PlanAction {
  id: string;
  evalId: string;
  orgId: string;
  statut: PlanStatut;
  createdBy: string;
  createdAt: string;
}

export interface Action {
  id: string;
  planId: string;
  critereCode?: string;
  domaineAmelioration: string;
  objectif: string;
  description: string;
  responsable: string;
  dateDebut?: string;
  dateEcheance: string;
  ressourcesDisponibles?: string | undefined;
  ressourcesNecessaires?: string | undefined;
  kpis?: string | undefined;
  statut: ActionStatut;
  priorite: ActionPriorite;
  createdAt: string;
}

export interface Suivi {
  id: string;
  actionId: string;
  commentaire: string;
  ancienStatut: ActionStatut;
  nouveauStatut: ActionStatut;
  preuvePath?: string;
  createdBy: string;
  createdAt: string;
}

// ── Dashboard Stats (généré par Cloud Functions) ──────────────────────────────

export interface DashboardStats {
  orgId: string;
  scoreGlobal: number;
  scoreParDimension: Record<string, number>;
  criteresEssentielsKO: string[];
  /** Version du référentiel consolidé — la consolidation n'en mélange jamais deux. */
  referentielVersion?: string | undefined;
  // Pour OSN uniquement
  nbAsn?: number;
  scoresAsn?: Record<string, number>;
  /** { orgId: ['F401','F405'] } — quel Faritany est en défaut, et sur quoi. */
  essentielsKoParOrg?: Record<string, string[]> | undefined;
  nbAsnAvecEssentielKo?: number | undefined;
  tauxCompletionEval?: number;  // % ASN ayant soumis dans la campagne active
  indiceVigilance?: number | undefined;
  updatedAt: string;
}

// ── Audit ──────────────────────────────────────────────────────────────────────

export type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'logout' | 'submit' | 'validate' | 'close'

export interface AuditEntry {
  id: string;
  userId: string;
  userEmail: string;
  action: AuditAction;
  resource: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

// ── Alertes (module Pilotage) ───────────────────────────────────────────────────

export type AlerteType = 'conformite' | 'derive_erp' | 'incoherence' | 'echeance' | 'inactivite';
export type AlerteSeverite = 'info' | 'vigilance' | 'critique';
export type AlerteStatut = 'ouverte' | 'prise_en_compte' | 'resolue' | 'ignoree';

export interface Alerte {
  id: string;
  orgId: string;
  type: AlerteType;
  severite: AlerteSeverite;
  titre: string;
  detail?: string | undefined;
  critereCode?: string | undefined;
  statut: AlerteStatut;
  createdAt: string;
}
