// =============================================================================
// Types générés depuis le schéma PostgreSQL GSAT
// En production : générer avec `supabase gen types typescript --local > src/types/supabase.generated.ts`
// Ce fichier est un squelette manuel — à remplacer par la génération automatique.
// =============================================================================

export type OrgType         = 'OMMS' | 'REGION' | 'OSN' | 'ASN'
export type RegionCode      = 'AFRICA' | 'ASIA_PACIFIC' | 'ARAB' | 'INTERAMERICA' | 'EUROPE' | 'EURASIA'
export type UserRole        = 'admin_global' | 'responsable_region' | 'responsable_osn' | 'utilisateur_asn' | 'evaluateur' | 'lecteur'
export type CampagneStatut  = 'planifiee' | 'ouverte' | 'fermee' | 'archivee'
export type EvalStatut      = 'brouillon' | 'en_cours' | 'soumise' | 'validee' | 'cloturee'
export type EvalType        = 'auto' | 'accompagnee'
export type PlanStatut      = 'brouillon' | 'actif' | 'cloture'
export type ActionStatut    = 'a_faire' | 'en_cours' | 'termine' | 'bloque'
export type ActionPriorite  = 'basse' | 'moyenne' | 'haute' | 'critique'
export type AuditAction     = 'create' | 'update' | 'delete' | 'login' | 'logout' | 'submit' | 'validate' | 'close'
export type ReviewerVerdict = 'approved' | 'approved_with_conditions' | 'revision_requested'
export type NotifType       = 'evaluation_created' | 'evaluation_submitted' | 'evaluation_validated' | 'evaluation_rejected' | 'campagne_opened' | 'campagne_closed' | 'workflow_assigned' | 'workflow_approved' | 'workflow_renvoye' | 'action_overdue' | 'user_created' | 'comment_added' | 'system'

// ---------------------------------------------------------------------------
// Skeleton Database type — à remplacer par `supabase gen types`
// ---------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      pays: {
        Row: {
          id: string
          code_iso: string
          nom_fr: string
          nom_en: string
          region_code: RegionCode
          actif: boolean
          created_at: string
        }
        Insert: {
          id?: string
          code_iso: string
          nom_fr: string
          nom_en: string
          region_code: RegionCode
          actif: boolean
        }
        Update: {
          id?: string
          code_iso?: string
          nom_fr?: string
          nom_en?: string
          region_code?: RegionCode
          actif?: boolean
        }
        Relationships: []
      }
      organisations: {
        Row: {
          id: string
          type: OrgType
          nom: string
          code: string | null
          parent_id: string | null
          pays_id: string | null
          region_code: RegionCode | null
          actif: boolean
          lat: number | null
          lng: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          type: OrgType
          nom: string
          code?: string | null
          parent_id?: string | null
          pays_id?: string | null
          region_code?: RegionCode | null
          actif: boolean
          lat?: number | null
          lng?: number | null
        }
        Update: {
          id?: string
          type?: OrgType
          nom?: string
          code?: string | null
          parent_id?: string | null
          pays_id?: string | null
          region_code?: RegionCode | null
          actif?: boolean
          lat?: number | null
          lng?: number | null
        }
        Relationships: []
      }
      users: {
        Row: {
          id: string
          org_id: string
          org_type: OrgType
          parent_org_id: string | null
          nom: string
          prenom: string
          email: string
          role: UserRole
          actif: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          org_id: string
          org_type: OrgType
          parent_org_id?: string | null
          nom: string
          prenom: string
          email: string
          role: UserRole
          actif: boolean
        }
        Update: {
          id?: string
          org_id?: string
          org_type?: OrgType
          parent_org_id?: string | null
          nom?: string
          prenom?: string
          email?: string
          role?: UserRole
          actif?: boolean
        }
        Relationships: []
      }
      campagnes: {
        Row: {
          id: string
          organisateur_id: string
          referentiel_version: string
          nom: string
          description: string | null
          date_ouverture: string
          date_fermeture: string
          statut: CampagneStatut
          perimetre: string[]
          evaluateur_id: string | null
          evaluateur_name: string | null
          reviewer_id: string | null
          reviewer_name: string | null
          approbateur_id: string | null
          approbateur_name: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organisateur_id: string
          referentiel_version: string
          nom: string
          description?: string | null
          date_ouverture: string
          date_fermeture: string
          statut: CampagneStatut
          perimetre: string[]
          evaluateur_id?: string | null
          evaluateur_name?: string | null
          reviewer_id?: string | null
          reviewer_name?: string | null
          approbateur_id?: string | null
          approbateur_name?: string | null
          created_by: string
        }
        Update: {
          id?: string
          organisateur_id?: string
          referentiel_version?: string
          nom?: string
          description?: string | null
          date_ouverture?: string
          date_fermeture?: string
          statut?: CampagneStatut
          perimetre?: string[]
          evaluateur_id?: string | null
          evaluateur_name?: string | null
          reviewer_id?: string | null
          reviewer_name?: string | null
          approbateur_id?: string | null
          approbateur_name?: string | null
          created_by?: string
        }
        Relationships: []
      }
      evaluations: {
        Row: {
          id: string
          campagne_id: string
          org_id: string
          type: EvalType
          statut: EvalStatut
          score_global: number | null
          score_par_dimension: Record<string, number> | null
          submitted_by: string | null
          submitted_at: string | null
          reviewer_name: string | null
          reviewer_title: string | null
          reviewer_avatar: string | null
          reviewer_recommendation: string | null
          reviewer_verdict: ReviewerVerdict | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          campagne_id: string
          org_id: string
          type: EvalType
          statut: EvalStatut
          submitted_by?: string | null
          submitted_at?: string | null
          reviewer_name?: string | null
          reviewer_title?: string | null
          reviewer_avatar?: string | null
          reviewer_recommendation?: string | null
          reviewer_verdict?: ReviewerVerdict | null
          created_by: string
        }
        Update: {
          id?: string
          campagne_id?: string
          org_id?: string
          type?: EvalType
          statut?: EvalStatut
          score_global?: number | null
          score_par_dimension?: Record<string, number> | null
          submitted_by?: string | null
          submitted_at?: string | null
          reviewer_name?: string | null
          reviewer_title?: string | null
          reviewer_avatar?: string | null
          reviewer_recommendation?: string | null
          reviewer_verdict?: ReviewerVerdict | null
          created_by?: string
        }
        Relationships: []
      }
      evaluation_scores: {
        Row: {
          id: string
          eval_id: string
          critere_code: string
          note: 0 | 1 | 2 | 3 | null
          commentaire: string | null
          updated_by: string
          updated_at: string
        }
        Insert: {
          id?: string
          eval_id: string
          critere_code: string
          note: 0 | 1 | 2 | 3 | null
          commentaire?: string | null
          updated_by: string
          updated_at: string
        }
        Update: {
          id?: string
          eval_id?: string
          critere_code?: string
          note?: 0 | 1 | 2 | 3 | null
          commentaire?: string | null
          updated_by?: string
          updated_at?: string
        }
        Relationships: []
      }
      evaluation_preuves: {
        Row: {
          id: string
          eval_id: string
          critere_code: string
          storage_path: string
          nom: string
          type_mime: string
          taille: number
          uploaded_by: string
          uploaded_at: string
        }
        Insert: {
          id?: string
          eval_id: string
          critere_code: string
          storage_path: string
          nom: string
          type_mime: string
          taille: number
          uploaded_by: string
          uploaded_at?: string
        }
        Update: {
          id?: string
          eval_id?: string
          critere_code?: string
          storage_path?: string
          nom?: string
          type_mime?: string
          taille?: number
          uploaded_by?: string
          uploaded_at?: string
        }
        Relationships: []
      }
      plans_action: {
        Row: {
          id: string
          eval_id: string
          org_id: string
          statut: PlanStatut
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          eval_id: string
          org_id: string
          statut: PlanStatut
          created_by: string
        }
        Update: {
          id?: string
          eval_id?: string
          org_id?: string
          statut?: PlanStatut
          created_by?: string
        }
        Relationships: []
      }
      plan_actions: {
        Row: {
          id: string
          plan_id: string
          critere_code: string | null
          domaine_amelioration: string
          objectif: string
          description: string
          responsable: string
          date_debut: string | null
          date_echeance: string
          ressources_disponibles: string | null
          ressources_necessaires: string | null
          kpis: string | null
          statut: ActionStatut
          priorite: ActionPriorite
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          plan_id: string
          critere_code?: string | null
          domaine_amelioration: string
          objectif: string
          description: string
          responsable: string
          date_debut?: string | null
          date_echeance: string
          ressources_disponibles?: string | null
          ressources_necessaires?: string | null
          kpis?: string | null
          statut: ActionStatut
          priorite: ActionPriorite
        }
        Update: {
          id?: string
          plan_id?: string
          critere_code?: string | null
          domaine_amelioration?: string
          objectif?: string
          description?: string
          responsable?: string
          date_debut?: string | null
          date_echeance?: string
          ressources_disponibles?: string | null
          ressources_necessaires?: string | null
          kpis?: string | null
          statut?: ActionStatut
          priorite?: ActionPriorite
        }
        Relationships: []
      }
      action_suivis: {
        Row: {
          id: string
          action_id: string
          commentaire: string
          ancien_statut: ActionStatut
          nouveau_statut: ActionStatut
          preuve_path: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          action_id: string
          commentaire: string
          ancien_statut: ActionStatut
          nouveau_statut: ActionStatut
          preuve_path?: string | null
          created_by: string
        }
        Update: {
          id?: string
          action_id?: string
          commentaire?: string
          ancien_statut?: ActionStatut
          nouveau_statut?: ActionStatut
          preuve_path?: string | null
          created_by?: string
        }
        Relationships: []
      }
      dashboard_stats: {
        Row: {
          org_id: string
          score_global: number | null
          score_par_dimension: Record<string, number>
          criteres_essentiels_ko: string[]
          nb_asn: number | null
          scores_asn: Record<string, number>
          taux_completion_eval: number | null
          updated_at: string
        }
        Insert: {
          org_id: string
          score_global?: number | null
          score_par_dimension: Record<string, number>
          criteres_essentiels_ko: string[]
          nb_asn?: number | null
          scores_asn: Record<string, number>
          taux_completion_eval?: number | null
          updated_at: string
        }
        Update: {
          org_id?: string
          score_global?: number | null
          score_par_dimension?: Record<string, number>
          criteres_essentiels_ko?: string[]
          nb_asn?: number | null
          scores_asn?: Record<string, number>
          taux_completion_eval?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          id: string
          user_id: string | null
          user_email: string
          action: AuditAction
          resource: string
          resource_id: string
          metadata: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          user_email: string
          action: AuditAction
          resource: string
          resource_id: string
          metadata?: Record<string, unknown> | null
        }
        Update: never
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          type: NotifType
          title: string
          message: string
          recipient_id: string
          sender_id: string | null
          sender_name: string | null
          resource_type: string | null
          resource_id: string | null
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          type: NotifType
          title: string
          message: string
          recipient_id: string
          sender_id?: string | null
          sender_name?: string | null
          resource_type?: string | null
          resource_id?: string | null
          read: boolean
        }
        Update: {
          read?: boolean
        }
        Relationships: []
      }
      referentiel_versions: {
        Row: {
          id: string
          version: string
          nom_fr: string
          nom_en: string
          actif: boolean
          created_at: string
        }
        Insert: {
          id?: string
          version: string
          nom_fr: string
          nom_en: string
          actif: boolean
        }
        Update: {
          id?: string
          version?: string
          nom_fr?: string
          nom_en?: string
          actif?: boolean
        }
        Relationships: []
      }
      dimensions: {
        Row: {
          id: string
          ref_id: string
          code: string
          nom_fr: string
          nom_en: string
          ordre: number
        }
        Insert: {
          id?: string
          ref_id: string
          code: string
          nom_fr: string
          nom_en: string
          ordre: number
        }
        Update: {
          id?: string
          ref_id?: string
          code?: string
          nom_fr?: string
          nom_en?: string
          ordre?: number
        }
        Relationships: []
      }
      criteres: {
        Row: {
          id: string
          dimension_id: string
          code: string
          libelle_fr: string
          libelle_en: string
          guide_fr: string | null
          guide_en: string | null
          essentiel: boolean
          actif: boolean
          ordre: number
        }
        Insert: {
          id?: string
          dimension_id: string
          code: string
          libelle_fr: string
          libelle_en: string
          guide_fr?: string | null
          guide_en?: string | null
          essentiel: boolean
          actif: boolean
          ordre: number
        }
        Update: {
          id?: string
          dimension_id?: string
          code?: string
          libelle_fr?: string
          libelle_en?: string
          guide_fr?: string | null
          guide_en?: string | null
          essentiel?: boolean
          actif?: boolean
          ordre?: number
        }
        Relationships: []
      }
      system_config: {
        Row: {
          id: string
          org_id: string
          site_name: string
          primary_lang: string
          timezone: string
          email_alerts: boolean
          critical_only: boolean
          digest_freq: string
          mfa: boolean
          session_timeout: string
          audit_log: boolean
          ip_whitelist: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          site_name: string
          primary_lang: string
          timezone: string
          email_alerts: boolean
          critical_only: boolean
          digest_freq: string
          mfa: boolean
          session_timeout: string
          audit_log: boolean
          ip_whitelist: boolean
        }
        Update: {
          id?: string
          org_id?: string
          site_name?: string
          primary_lang?: string
          timezone?: string
          email_alerts?: boolean
          critical_only?: boolean
          digest_freq?: string
          mfa?: boolean
          session_timeout?: string
          audit_log?: boolean
          ip_whitelist?: boolean
        }
        Relationships: []
      }
      rate_limits: {
        Row: { id: string; key: string; count: number; reset_at: string; created_at: string }
        Insert: { id?: string; key: string; count: number; reset_at: string }
        Update: { id?: string; key?: string; count?: number; reset_at?: string }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      fn_write_audit_log: {
        Args: {
          p_user_id: string
          p_user_email: string
          p_action: string
          p_resource: string
          p_resource_id: string
          p_metadata: Record<string, unknown> | null
        }
        Returns: undefined
      }
    }
    Enums: {
      org_type: OrgType
      user_role: UserRole
      campagne_statut: CampagneStatut
      eval_statut: EvalStatut
      eval_type: EvalType
      plan_statut: PlanStatut
      action_statut: ActionStatut
      action_priorite: ActionPriorite
      audit_action: AuditAction
    }
  }
}
