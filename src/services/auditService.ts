import { supabase } from './supabase'
import type { AuditEntry, AuditAction } from '@/types'
import type { Json } from '@/types/supabase.generated'

const TABLE = 'audit_log'
const PAGE_SIZE = 25

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AuditFilters {
  action?:   AuditAction | undefined
  userId?:   string
  resource?: string | undefined
  dateFrom?: Date | undefined
  dateTo?:   Date | undefined
}

export interface AuditPage {
  entries: AuditEntry[]
  /** Offset pour la page suivante (remplace DocumentSnapshot de Firestore) */
  nextOffset: number
  hasMore: boolean
}

// ── Écriture ──────────────────────────────────────────────────────────────────

export async function writeAuditEntry(
  entry: Omit<AuditEntry, 'id' | 'timestamp'>,
): Promise<void> {
  try {
    // I1: appel RPC (SECURITY DEFINER) au lieu d'un INSERT direct sur audit_log
    // La fonction valide user_id = auth.uid() côté PostgreSQL et bypasse RLS.
    const { error } = await supabase.rpc('fn_write_audit_log', {
      p_user_id:     entry.userId,
      p_user_email:  entry.userEmail,
      p_action:      entry.action,
      p_resource:    entry.resource,
      p_resource_id: entry.resourceId,
      // Frontière DB : la metadata applicative (Record<string, unknown>) est
      // toujours JSON-sérialisable ; le type généré l'exige en Json.
      p_metadata:    (entry.metadata ?? null) as Json,
    })
    if (error) throw error
  } catch (err) {
    // L'audit ne doit jamais bloquer l'action principale
    console.error('[auditService] writeAuditEntry failed:', err)
  }
}

// ── Lecture paginée ────────────────────────────────────────────────────────────

export async function queryAuditLog(
  filters: AuditFilters = {},
  cursor: number | null = null,
): Promise<AuditPage> {
  const offset = cursor ?? 0

  let q = supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    // I5: range inclusif des deux côtés — récupérer PAGE_SIZE+1 pour détecter hasMore
    .range(offset, offset + PAGE_SIZE)

  if (filters.action)   q = q.eq('action', filters.action)
  if (filters.userId)   q = q.eq('user_id', filters.userId)
  if (filters.resource) q = q.eq('resource', filters.resource)
  if (filters.dateFrom) q = q.gte('created_at', filters.dateFrom.toISOString())
  if (filters.dateTo)   q = q.lte('created_at', filters.dateTo.toISOString())

  const { data, error } = await q

  if (error) throw error

  const rows = data ?? []
  const hasMore = rows.length > PAGE_SIZE
  const pageRows = hasMore ? rows.slice(0, PAGE_SIZE) : rows

  const entries: AuditEntry[] = pageRows.map((row) => {
    const r        = row as Record<string, unknown>;
    const metadata = r['metadata'] as Record<string, unknown> | null | undefined;
    return {
      id:        r['id']         as string,
      userId:    r['user_id']    as string,
      userEmail: r['user_email'] as string,
      action:    r['action']     as AuditAction,
      resource:  r['resource']   as string,
      resourceId: r['resource_id'] as string,
      timestamp: r['created_at'] as string,
      ...(metadata != null ? { metadata } : {}),
    };
  })

  return {
    entries,
    nextOffset: offset + pageRows.length,
    hasMore,
  }
}
