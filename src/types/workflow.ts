/**
 * Workflow & Role Assignment types
 * Used by WorkflowPage, WorkflowDetailPage and related components.
 */

// ── Workflow Steps ───────────────────────────────────────────────────────────

export type WorkflowStep =
  | 'initiation'
  | 'evaluation'
  | 'review'
  | 'approbation'
  | 'finalisation';

export interface WorkflowStepDef {
  step: WorkflowStep;
  label: string;
  icon: string;
  completedAt?: Date | undefined;
  completedBy?: string | undefined;
}

export interface WorkflowState {
  currentStep: WorkflowStep;
  steps: WorkflowStepDef[];
}

// ── Role Assignments ─────────────────────────────────────────────────────────

export type AssignmentRole = 'evaluateur' | 'reviewer' | 'approbateur';

export type AssignmentStatus = 'validated' | 'in_progress' | 'not_assigned';

export interface RoleAssignment {
  role: AssignmentRole;
  userId?: string | undefined;
  userName?: string | undefined;
  userTitle?: string | undefined;
  userAvatar?: string | undefined;
  status: AssignmentStatus;
  itemCount?: number | undefined;
  itemLabel?: string | undefined;
}

// ── Timeline Events ──────────────────────────────────────────────────────────

export interface WorkflowEvent {
  id: string;
  action: string;
  actor?: string | undefined;
  timestamp: Date;
  detail?: string | undefined;
}

// ── Entity Details ───────────────────────────────────────────────────────────

export interface EntityDetails {
  name: string;
  type: string;
  lastEvaluation?: string | undefined;
  contactPrincipal?: string | undefined;
  conformityPercent?: number | undefined;
}

// ── Evidence Summary ─────────────────────────────────────────────────────────

export interface EvidenceCategory {
  icon: string;
  label: string;
  count: number;
}
