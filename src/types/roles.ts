import type { UserRole } from './index'

/**
 * Rôles autorisés à valider une évaluation (statut soumise → validee).
 * Source unique pour useEvaluation.ts, ValidationPage et ValidationReportPage.
 */
export const VALIDATION_ROLES: readonly UserRole[] = [
  'admin_global',
  'responsable_osn',
  'responsable_region',
  'evaluateur',
] as const
