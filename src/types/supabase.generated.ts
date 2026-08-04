export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      action_suivis: {
        Row: {
          action_id: string
          ancien_statut: Database["public"]["Enums"]["action_statut"]
          commentaire: string
          created_at: string
          created_by: string
          id: string
          nouveau_statut: Database["public"]["Enums"]["action_statut"]
          preuve_path: string | null
        }
        Insert: {
          action_id: string
          ancien_statut: Database["public"]["Enums"]["action_statut"]
          commentaire: string
          created_at?: string
          created_by: string
          id?: string
          nouveau_statut: Database["public"]["Enums"]["action_statut"]
          preuve_path?: string | null
        }
        Update: {
          action_id?: string
          ancien_statut?: Database["public"]["Enums"]["action_statut"]
          commentaire?: string
          created_at?: string
          created_by?: string
          id?: string
          nouveau_statut?: Database["public"]["Enums"]["action_statut"]
          preuve_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "action_suivis_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "plan_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_suivis_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      action_templates: {
        Row: {
          actif: boolean
          critere_code: string
          description: string
          duree_jours: number
          id: string
          kpi_suggere: string | null
          objectif: string
          priorite: Database["public"]["Enums"]["action_priorite"]
        }
        Insert: {
          actif?: boolean
          critere_code: string
          description?: string
          duree_jours?: number
          id?: string
          kpi_suggere?: string | null
          objectif: string
          priorite?: Database["public"]["Enums"]["action_priorite"]
        }
        Update: {
          actif?: boolean
          critere_code?: string
          description?: string
          duree_jours?: number
          id?: string
          kpi_suggere?: string | null
          objectif?: string
          priorite?: Database["public"]["Enums"]["action_priorite"]
        }
        Relationships: []
      }
      alerte_regles: {
        Row: {
          actif: boolean
          action_template_id: string | null
          code: string
          created_at: string
          destinataires: string[]
          expression: Json
          hysteresis: number
          id: string
          message_fr: string
          message_mg: string | null
          org_id: string | null
          severite: Database["public"]["Enums"]["alerte_severite"]
          type: Database["public"]["Enums"]["alerte_type"]
        }
        Insert: {
          actif?: boolean
          action_template_id?: string | null
          code: string
          created_at?: string
          destinataires?: string[]
          expression: Json
          hysteresis?: number
          id?: string
          message_fr: string
          message_mg?: string | null
          org_id?: string | null
          severite?: Database["public"]["Enums"]["alerte_severite"]
          type: Database["public"]["Enums"]["alerte_type"]
        }
        Update: {
          actif?: boolean
          action_template_id?: string | null
          code?: string
          created_at?: string
          destinataires?: string[]
          expression?: Json
          hysteresis?: number
          id?: string
          message_fr?: string
          message_mg?: string | null
          org_id?: string | null
          severite?: Database["public"]["Enums"]["alerte_severite"]
          type?: Database["public"]["Enums"]["alerte_type"]
        }
        Relationships: [
          {
            foreignKeyName: "alerte_regles_action_template_id_fkey"
            columns: ["action_template_id"]
            isOneToOne: false
            referencedRelation: "action_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerte_regles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      alertes: {
        Row: {
          action_id: string | null
          created_at: string
          critere_code: string | null
          detail: string | null
          id: string
          motif_ignore: string | null
          org_id: string
          regle_id: string | null
          resolved_at: string | null
          severite: Database["public"]["Enums"]["alerte_severite"]
          statut: Database["public"]["Enums"]["alerte_statut"]
          titre: string
          type: Database["public"]["Enums"]["alerte_type"]
          valeur: Json | null
        }
        Insert: {
          action_id?: string | null
          created_at?: string
          critere_code?: string | null
          detail?: string | null
          id?: string
          motif_ignore?: string | null
          org_id: string
          regle_id?: string | null
          resolved_at?: string | null
          severite: Database["public"]["Enums"]["alerte_severite"]
          statut?: Database["public"]["Enums"]["alerte_statut"]
          titre: string
          type: Database["public"]["Enums"]["alerte_type"]
          valeur?: Json | null
        }
        Update: {
          action_id?: string | null
          created_at?: string
          critere_code?: string | null
          detail?: string | null
          id?: string
          motif_ignore?: string | null
          org_id?: string
          regle_id?: string | null
          resolved_at?: string | null
          severite?: Database["public"]["Enums"]["alerte_severite"]
          statut?: Database["public"]["Enums"]["alerte_statut"]
          titre?: string
          type?: Database["public"]["Enums"]["alerte_type"]
          valeur?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "alertes_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "plan_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertes_regle_id_fkey"
            columns: ["regle_id"]
            isOneToOne: false
            referencedRelation: "alerte_regles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          created_at: string
          id: string
          metadata: Json | null
          resource: string
          resource_id: string
          user_email: string
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          created_at?: string
          id?: string
          metadata?: Json | null
          resource: string
          resource_id: string
          user_email: string
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          created_at?: string
          id?: string
          metadata?: Json | null
          resource?: string
          resource_id?: string
          user_email?: string
          user_id?: string | null
        }
        Relationships: []
      }
      campagnes: {
        Row: {
          approbateur_id: string | null
          approbateur_name: string | null
          created_at: string
          created_by: string
          date_fermeture: string
          date_ouverture: string
          description: string | null
          evaluateur_id: string | null
          evaluateur_name: string | null
          id: string
          mode: Database["public"]["Enums"]["campagne_mode"]
          nom: string
          organisateur_id: string
          perimetre: string[]
          referentiel_version: string
          reviewer_id: string | null
          reviewer_name: string | null
          statut: Database["public"]["Enums"]["campagne_statut"]
          updated_at: string
        }
        Insert: {
          approbateur_id?: string | null
          approbateur_name?: string | null
          created_at?: string
          created_by: string
          date_fermeture: string
          date_ouverture: string
          description?: string | null
          evaluateur_id?: string | null
          evaluateur_name?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["campagne_mode"]
          nom: string
          organisateur_id: string
          perimetre?: string[]
          referentiel_version: string
          reviewer_id?: string | null
          reviewer_name?: string | null
          statut?: Database["public"]["Enums"]["campagne_statut"]
          updated_at?: string
        }
        Update: {
          approbateur_id?: string | null
          approbateur_name?: string | null
          created_at?: string
          created_by?: string
          date_fermeture?: string
          date_ouverture?: string
          description?: string | null
          evaluateur_id?: string | null
          evaluateur_name?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["campagne_mode"]
          nom?: string
          organisateur_id?: string
          perimetre?: string[]
          referentiel_version?: string
          reviewer_id?: string | null
          reviewer_name?: string | null
          statut?: Database["public"]["Enums"]["campagne_statut"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campagnes_approbateur_id_fkey"
            columns: ["approbateur_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campagnes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campagnes_evaluateur_id_fkey"
            columns: ["evaluateur_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campagnes_organisateur_id_fkey"
            columns: ["organisateur_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campagnes_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      criteres: {
        Row: {
          actif: boolean
          code: string
          dimension_id: string
          essentiel: boolean
          guide_en: string | null
          guide_fr: string | null
          guide_mg: string | null
          id: string
          indicateur_erp: string[]
          libelle_en: string
          libelle_fr: string
          libelle_mg: string | null
          ordre: number
          socle: boolean
          source_codes: string[]
        }
        Insert: {
          actif?: boolean
          code: string
          dimension_id: string
          essentiel?: boolean
          guide_en?: string | null
          guide_fr?: string | null
          guide_mg?: string | null
          id?: string
          indicateur_erp?: string[]
          libelle_en: string
          libelle_fr: string
          libelle_mg?: string | null
          ordre?: number
          socle?: boolean
          source_codes?: string[]
        }
        Update: {
          actif?: boolean
          code?: string
          dimension_id?: string
          essentiel?: boolean
          guide_en?: string | null
          guide_fr?: string | null
          guide_mg?: string | null
          id?: string
          indicateur_erp?: string[]
          libelle_en?: string
          libelle_fr?: string
          libelle_mg?: string | null
          ordre?: number
          socle?: boolean
          source_codes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "criteres_dimension_id_fkey"
            columns: ["dimension_id"]
            isOneToOne: false
            referencedRelation: "dimensions"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_stats: {
        Row: {
          criteres_essentiels_ko: string[]
          essentiels_ko_par_org: Json
          indice_vigilance: number | null
          nb_asn: number | null
          nb_asn_avec_essentiel_ko: number | null
          org_id: string
          referentiel_version: string | null
          score_global: number | null
          score_par_dimension: Json
          scores_asn: Json
          taux_completion_eval: number | null
          updated_at: string
        }
        Insert: {
          criteres_essentiels_ko?: string[]
          essentiels_ko_par_org?: Json
          indice_vigilance?: number | null
          nb_asn?: number | null
          nb_asn_avec_essentiel_ko?: number | null
          org_id: string
          referentiel_version?: string | null
          score_global?: number | null
          score_par_dimension?: Json
          scores_asn?: Json
          taux_completion_eval?: number | null
          updated_at?: string
        }
        Update: {
          criteres_essentiels_ko?: string[]
          essentiels_ko_par_org?: Json
          indice_vigilance?: number | null
          nb_asn?: number | null
          nb_asn_avec_essentiel_ko?: number | null
          org_id?: string
          referentiel_version?: string | null
          score_global?: number | null
          score_par_dimension?: Json
          scores_asn?: Json
          taux_completion_eval?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_stats_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      dimensions: {
        Row: {
          code: string
          id: string
          nom_en: string
          nom_fr: string
          nom_mg: string | null
          ordre: number
          ref_id: string
        }
        Insert: {
          code: string
          id?: string
          nom_en: string
          nom_fr: string
          nom_mg?: string | null
          ordre?: number
          ref_id: string
        }
        Update: {
          code?: string
          id?: string
          nom_en?: string
          nom_fr?: string
          nom_mg?: string | null
          ordre?: number
          ref_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dimensions_ref_id_fkey"
            columns: ["ref_id"]
            isOneToOne: false
            referencedRelation: "referentiel_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_snapshots: {
        Row: {
          collected_at: string
          completude: number | null
          id: string
          importe_par: string | null
          indicateurs: Json
          org_id: string
          periode: string
          source: string
        }
        Insert: {
          collected_at?: string
          completude?: number | null
          id?: string
          importe_par?: string | null
          indicateurs?: Json
          org_id: string
          periode: string
          source?: string
        }
        Update: {
          collected_at?: string
          completude?: number | null
          id?: string
          importe_par?: string | null
          indicateurs?: Json
          org_id?: string
          periode?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_snapshots_importe_par_fkey"
            columns: ["importe_par"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_preuves: {
        Row: {
          critere_code: string
          eval_id: string
          id: string
          nom: string
          storage_path: string
          taille: number
          type_mime: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          critere_code: string
          eval_id: string
          id?: string
          nom: string
          storage_path: string
          taille: number
          type_mime: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          critere_code?: string
          eval_id?: string
          id?: string
          nom?: string
          storage_path?: string
          taille?: number
          type_mime?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_preuves_eval_id_fkey"
            columns: ["eval_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_preuves_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_scores: {
        Row: {
          commentaire: string | null
          critere_code: string
          eval_id: string
          id: string
          note: number | null
          updated_at: string
          updated_by: string
        }
        Insert: {
          commentaire?: string | null
          critere_code: string
          eval_id: string
          id?: string
          note?: number | null
          updated_at?: string
          updated_by: string
        }
        Update: {
          commentaire?: string | null
          critere_code?: string
          eval_id?: string
          id?: string
          note?: number | null
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_scores_eval_id_fkey"
            columns: ["eval_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_scores_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          campagne_id: string
          cloturee_auto: boolean
          created_at: string
          created_by: string
          id: string
          org_id: string
          pv_comite_path: string | null
          reviewer_avatar: string | null
          reviewer_name: string | null
          reviewer_recommendation: string | null
          reviewer_title: string | null
          reviewer_verdict:
            | Database["public"]["Enums"]["reviewer_verdict"]
            | null
          revue_at: string | null
          revue_echeance_at: string | null
          revue_motif: string | null
          revue_par: string | null
          score_global: number | null
          score_par_dimension: Json | null
          statut: Database["public"]["Enums"]["eval_statut"]
          submitted_at: string | null
          submitted_by: string | null
          type: Database["public"]["Enums"]["eval_type"]
          updated_at: string
          validee_at: string | null
          validee_par: string | null
        }
        Insert: {
          campagne_id: string
          cloturee_auto?: boolean
          created_at?: string
          created_by: string
          id?: string
          org_id: string
          pv_comite_path?: string | null
          reviewer_avatar?: string | null
          reviewer_name?: string | null
          reviewer_recommendation?: string | null
          reviewer_title?: string | null
          reviewer_verdict?:
            | Database["public"]["Enums"]["reviewer_verdict"]
            | null
          revue_at?: string | null
          revue_echeance_at?: string | null
          revue_motif?: string | null
          revue_par?: string | null
          score_global?: number | null
          score_par_dimension?: Json | null
          statut?: Database["public"]["Enums"]["eval_statut"]
          submitted_at?: string | null
          submitted_by?: string | null
          type: Database["public"]["Enums"]["eval_type"]
          updated_at?: string
          validee_at?: string | null
          validee_par?: string | null
        }
        Update: {
          campagne_id?: string
          cloturee_auto?: boolean
          created_at?: string
          created_by?: string
          id?: string
          org_id?: string
          pv_comite_path?: string | null
          reviewer_avatar?: string | null
          reviewer_name?: string | null
          reviewer_recommendation?: string | null
          reviewer_title?: string | null
          reviewer_verdict?:
            | Database["public"]["Enums"]["reviewer_verdict"]
            | null
          revue_at?: string | null
          revue_echeance_at?: string | null
          revue_motif?: string | null
          revue_par?: string | null
          score_global?: number | null
          score_par_dimension?: Json | null
          statut?: Database["public"]["Enums"]["eval_statut"]
          submitted_at?: string | null
          submitted_by?: string | null
          type?: Database["public"]["Enums"]["eval_type"]
          updated_at?: string
          validee_at?: string | null
          validee_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_campagne_id_fkey"
            columns: ["campagne_id"]
            isOneToOne: false
            referencedRelation: "campagnes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_revue_par_fkey"
            columns: ["revue_par"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_validee_par_fkey"
            columns: ["validee_par"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          recipient_id: string
          resource_id: string | null
          resource_type: string | null
          sender_id: string | null
          sender_name: string | null
          title: string
          type: Database["public"]["Enums"]["notif_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          recipient_id: string
          resource_id?: string | null
          resource_type?: string | null
          sender_id?: string | null
          sender_name?: string | null
          title: string
          type: Database["public"]["Enums"]["notif_type"]
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          recipient_id?: string
          resource_id?: string | null
          resource_type?: string | null
          sender_id?: string | null
          sender_name?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notif_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          actif: boolean
          code: string | null
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          nom: string
          parent_id: string | null
          pays_id: string | null
          poids: number
          region_code: Database["public"]["Enums"]["region_code"] | null
          type: Database["public"]["Enums"]["org_type"]
          updated_at: string
        }
        Insert: {
          actif?: boolean
          code?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          nom: string
          parent_id?: string | null
          pays_id?: string | null
          poids?: number
          region_code?: Database["public"]["Enums"]["region_code"] | null
          type: Database["public"]["Enums"]["org_type"]
          updated_at?: string
        }
        Update: {
          actif?: boolean
          code?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          nom?: string
          parent_id?: string | null
          pays_id?: string | null
          poids?: number
          region_code?: Database["public"]["Enums"]["region_code"] | null
          type?: Database["public"]["Enums"]["org_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organisations_pays_id_fkey"
            columns: ["pays_id"]
            isOneToOne: false
            referencedRelation: "pays"
            referencedColumns: ["id"]
          },
        ]
      }
      pays: {
        Row: {
          actif: boolean
          code_iso: string
          created_at: string
          id: string
          nom_en: string
          nom_fr: string
          region_code: Database["public"]["Enums"]["region_code"]
        }
        Insert: {
          actif?: boolean
          code_iso: string
          created_at?: string
          id?: string
          nom_en: string
          nom_fr: string
          region_code: Database["public"]["Enums"]["region_code"]
        }
        Update: {
          actif?: boolean
          code_iso?: string
          created_at?: string
          id?: string
          nom_en?: string
          nom_fr?: string
          region_code?: Database["public"]["Enums"]["region_code"]
        }
        Relationships: []
      }
      plan_actions: {
        Row: {
          created_at: string
          critere_code: string | null
          date_debut: string | null
          date_echeance: string
          description: string
          domaine_amelioration: string
          id: string
          kpis: string | null
          objectif: string
          plan_id: string
          priorite: Database["public"]["Enums"]["action_priorite"]
          responsable: string
          ressources_disponibles: string | null
          ressources_necessaires: string | null
          statut: Database["public"]["Enums"]["action_statut"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          critere_code?: string | null
          date_debut?: string | null
          date_echeance: string
          description?: string
          domaine_amelioration: string
          id?: string
          kpis?: string | null
          objectif: string
          plan_id: string
          priorite?: Database["public"]["Enums"]["action_priorite"]
          responsable?: string
          ressources_disponibles?: string | null
          ressources_necessaires?: string | null
          statut?: Database["public"]["Enums"]["action_statut"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          critere_code?: string | null
          date_debut?: string | null
          date_echeance?: string
          description?: string
          domaine_amelioration?: string
          id?: string
          kpis?: string | null
          objectif?: string
          plan_id?: string
          priorite?: Database["public"]["Enums"]["action_priorite"]
          responsable?: string
          ressources_disponibles?: string | null
          ressources_necessaires?: string | null
          statut?: Database["public"]["Enums"]["action_statut"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_actions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans_action"
            referencedColumns: ["id"]
          },
        ]
      }
      plans_action: {
        Row: {
          created_at: string
          created_by: string
          eval_id: string
          id: string
          org_id: string
          statut: Database["public"]["Enums"]["plan_statut"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          eval_id: string
          id?: string
          org_id: string
          statut?: Database["public"]["Enums"]["plan_statut"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          eval_id?: string
          id?: string
          org_id?: string
          statut?: Database["public"]["Enums"]["plan_statut"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plans_action_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_action_eval_id_fkey"
            columns: ["eval_id"]
            isOneToOne: true
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_action_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          count: number
          id: string
          key: string
          updated_at: string
          window_end: string
        }
        Insert: {
          count?: number
          id?: string
          key: string
          updated_at?: string
          window_end: string
        }
        Update: {
          count?: number
          id?: string
          key?: string
          updated_at?: string
          window_end?: string
        }
        Relationships: []
      }
      referentiel_history: {
        Row: {
          created_at: string
          diff: Json
          id: string
          modified_by: string | null
          ref_id: string
        }
        Insert: {
          created_at?: string
          diff: Json
          id?: string
          modified_by?: string | null
          ref_id: string
        }
        Update: {
          created_at?: string
          diff?: Json
          id?: string
          modified_by?: string | null
          ref_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referentiel_history_ref_id_fkey"
            columns: ["ref_id"]
            isOneToOne: false
            referencedRelation: "referentiel_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      referentiel_versions: {
        Row: {
          actif: boolean
          created_at: string
          id: string
          niveau: Database["public"]["Enums"]["org_type"] | null
          nom_en: string
          nom_fr: string
          nom_mg: string | null
          parent_version: string | null
          version: string
        }
        Insert: {
          actif?: boolean
          created_at?: string
          id?: string
          niveau?: Database["public"]["Enums"]["org_type"] | null
          nom_en: string
          nom_fr: string
          nom_mg?: string | null
          parent_version?: string | null
          version: string
        }
        Update: {
          actif?: boolean
          created_at?: string
          id?: string
          niveau?: Database["public"]["Enums"]["org_type"] | null
          nom_en?: string
          nom_fr?: string
          nom_mg?: string | null
          parent_version?: string | null
          version?: string
        }
        Relationships: []
      }
      system_config: {
        Row: {
          audit_log: boolean
          critical_only: boolean
          digest_freq: string
          email_alerts: boolean
          id: string
          ip_whitelist: boolean
          libelle_niveau_local: string
          mfa: boolean
          org_id: string
          primary_lang: string
          revue_delai_jours: number
          session_timeout: string
          site_name: string
          timezone: string
          updated_at: string
        }
        Insert: {
          audit_log?: boolean
          critical_only?: boolean
          digest_freq?: string
          email_alerts?: boolean
          id?: string
          ip_whitelist?: boolean
          libelle_niveau_local?: string
          mfa?: boolean
          org_id: string
          primary_lang?: string
          revue_delai_jours?: number
          session_timeout?: string
          site_name?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          audit_log?: boolean
          critical_only?: boolean
          digest_freq?: string
          email_alerts?: boolean
          id?: string
          ip_whitelist?: boolean
          libelle_niveau_local?: string
          mfa?: boolean
          org_id?: string
          primary_lang?: string
          revue_delai_jours?: number
          session_timeout?: string
          site_name?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_config_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          actif: boolean
          created_at: string
          email: string
          id: string
          nom: string
          org_id: string
          org_type: Database["public"]["Enums"]["org_type"]
          parent_org_id: string | null
          prenom: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          actif?: boolean
          created_at?: string
          email: string
          id: string
          nom: string
          org_id: string
          org_type: Database["public"]["Enums"]["org_type"]
          parent_org_id?: string | null
          prenom: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          actif?: boolean
          created_at?: string
          email?: string
          id?: string
          nom?: string
          org_id?: string
          org_type?: Database["public"]["Enums"]["org_type"]
          parent_org_id?: string | null
          prenom?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_parent_org_id_fkey"
            columns: ["parent_org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_erp_snapshot_courant: {
        Row: {
          collected_at: string | null
          completude: number | null
          indicateurs: Json | null
          org_id: string | null
          periode: string | null
          source: string | null
        }
        Relationships: [
          {
            foreignKeyName: "erp_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      fn_cloturer_evaluations_non_revues: { Args: never; Returns: number }
      fn_write_audit_log: {
        Args: {
          p_action: string
          p_metadata?: Json
          p_resource: string
          p_resource_id: string
          p_user_email: string
          p_user_id: string
        }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      action_priorite: "basse" | "moyenne" | "haute" | "critique"
      action_statut: "a_faire" | "en_cours" | "termine" | "bloque"
      alerte_severite: "info" | "vigilance" | "critique"
      alerte_statut: "ouverte" | "prise_en_compte" | "resolue" | "ignoree"
      alerte_type:
        | "conformite"
        | "derive_erp"
        | "incoherence"
        | "echeance"
        | "inactivite"
      audit_action:
        | "create"
        | "update"
        | "delete"
        | "login"
        | "logout"
        | "submit"
        | "validate"
        | "close"
      campagne_mode: "socle" | "complet"
      campagne_statut: "planifiee" | "ouverte" | "fermee" | "archivee"
      eval_statut: "brouillon" | "en_cours" | "soumise" | "validee" | "cloturee"
      eval_type: "auto" | "accompagnee"
      notif_type:
        | "evaluation_created"
        | "evaluation_submitted"
        | "evaluation_validated"
        | "evaluation_rejected"
        | "campagne_opened"
        | "campagne_closed"
        | "workflow_assigned"
        | "workflow_approved"
        | "workflow_renvoye"
        | "action_overdue"
        | "user_created"
        | "comment_added"
        | "system"
        | "alerte_critique"
        | "alerte_incoherence"
        | "snapshot_erp_recu"
        | "evaluation_auto_validee"
        | "revue_echeance_proche"
      org_type: "OMMS" | "REGION" | "OSN" | "ASN"
      plan_statut: "brouillon" | "actif" | "cloture"
      region_code:
        | "AFRICA"
        | "ASIA_PACIFIC"
        | "ARAB"
        | "INTERAMERICA"
        | "EUROPE"
        | "EURASIA"
      reviewer_verdict:
        | "approved"
        | "approved_with_conditions"
        | "revision_requested"
      user_role:
        | "admin_global"
        | "responsable_region"
        | "responsable_osn"
        | "utilisateur_asn"
        | "evaluateur"
        | "lecteur"
        | "responsable_asn"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      action_priorite: ["basse", "moyenne", "haute", "critique"],
      action_statut: ["a_faire", "en_cours", "termine", "bloque"],
      alerte_severite: ["info", "vigilance", "critique"],
      alerte_statut: ["ouverte", "prise_en_compte", "resolue", "ignoree"],
      alerte_type: [
        "conformite",
        "derive_erp",
        "incoherence",
        "echeance",
        "inactivite",
      ],
      audit_action: [
        "create",
        "update",
        "delete",
        "login",
        "logout",
        "submit",
        "validate",
        "close",
      ],
      campagne_mode: ["socle", "complet"],
      campagne_statut: ["planifiee", "ouverte", "fermee", "archivee"],
      eval_statut: ["brouillon", "en_cours", "soumise", "validee", "cloturee"],
      eval_type: ["auto", "accompagnee"],
      notif_type: [
        "evaluation_created",
        "evaluation_submitted",
        "evaluation_validated",
        "evaluation_rejected",
        "campagne_opened",
        "campagne_closed",
        "workflow_assigned",
        "workflow_approved",
        "workflow_renvoye",
        "action_overdue",
        "user_created",
        "comment_added",
        "system",
        "alerte_critique",
        "alerte_incoherence",
        "snapshot_erp_recu",
        "evaluation_auto_validee",
        "revue_echeance_proche",
      ],
      org_type: ["OMMS", "REGION", "OSN", "ASN"],
      plan_statut: ["brouillon", "actif", "cloture"],
      region_code: [
        "AFRICA",
        "ASIA_PACIFIC",
        "ARAB",
        "INTERAMERICA",
        "EUROPE",
        "EURASIA",
      ],
      reviewer_verdict: [
        "approved",
        "approved_with_conditions",
        "revision_requested",
      ],
      user_role: [
        "admin_global",
        "responsable_region",
        "responsable_osn",
        "utilisateur_asn",
        "evaluateur",
        "lecteur",
        "responsable_asn",
      ],
    },
  },
} as const

