/**
 * actionPlanReport.ts
 *
 * Generates a PDF report for an action plan.
 * Sections:
 *   1. Summary (total actions, completion rate, KPIs)
 *   2. Actions by status (table)
 *   3. Timeline & responsibilities
 */

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  pdfColors,
  pdfFonts,
  pdfFontSize,
  pdfLayout,
  pdfContentWidth,
  pdfTableStyles,
  drawHeader,
  drawFooter,
  type PdfMeta,
} from './pdfTheme'
import type { PlanAction, Action, ActionStatut } from '@/types'

// ── Input ────────────────────────────────────────────────────────────────────

export interface ActionPlanReportInput {
  plan: PlanAction
  actions: Action[]
  orgName: string
  campagneName: string
  lang?: 'fr' | 'en'
}

// ── Labels ───────────────────────────────────────────────────────────────────

const LABELS = {
  fr: {
    title: "RAPPORT DU PLAN D'ACTION",
    summary: 'RESUME',
    actionsByStatus: 'ACTIONS PAR STATUT',
    timeline: 'PLANIFICATION',
    totalActions: 'Actions totales',
    completed: 'Terminées',
    inProgress: 'En cours',
    blocked: 'Bloquées',
    todo: 'À faire',
    completion: 'Taux de complétion',
    objective: 'Objectif',
    domain: 'Domaine',
    responsible: 'Responsable',
    dueDate: 'Échéance',
    status: 'Statut',
    priority: 'Priorité',
    kpis: 'KPIs',
    description: 'Description',
    criterion: 'Critère',
    organisation: 'Organisation',
    campaign: 'Campagne',
    dateGenerated: 'Date de génération',
    section: 'SECTION',
    statusLabels: {
      a_faire: 'À faire',
      en_cours: 'En cours',
      termine: 'Terminé',
      bloque: 'Bloqué',
    } as Record<string, string>,
    priorityLabels: {
      basse: 'Basse',
      moyenne: 'Moyenne',
      haute: 'Haute',
      critique: 'Critique',
    } as Record<string, string>,
  },
  en: {
    title: 'ACTION PLAN REPORT',
    summary: 'SUMMARY',
    actionsByStatus: 'ACTIONS BY STATUS',
    timeline: 'PLANNING',
    totalActions: 'Total actions',
    completed: 'Completed',
    inProgress: 'In progress',
    blocked: 'Blocked',
    todo: 'To do',
    completion: 'Completion rate',
    objective: 'Objective',
    domain: 'Domain',
    responsible: 'Responsible',
    dueDate: 'Due date',
    status: 'Status',
    priority: 'Priority',
    kpis: 'KPIs',
    description: 'Description',
    criterion: 'Criterion',
    organisation: 'Organisation',
    campaign: 'Campaign',
    dateGenerated: 'Date generated',
    section: 'SECTION',
    statusLabels: {
      a_faire: 'To do',
      en_cours: 'In progress',
      termine: 'Done',
      bloque: 'Blocked',
    } as Record<string, string>,
    priorityLabels: {
      basse: 'Low',
      moyenne: 'Medium',
      haute: 'High',
      critique: 'Critical',
    } as Record<string, string>,
  },
} as const

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string | undefined): string {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return '-'
  }
}

function getStatusColor(statut: ActionStatut): string {
  switch (statut) {
    case 'termine': return pdfColors.scoreExcellent
    case 'en_cours': return pdfColors.scoreCorrect
    case 'bloque': return pdfColors.scoreCritical
    case 'a_faire':
    default: return pdfColors.outline
  }
}

// ── Generator ────────────────────────────────────────────────────────────────

export async function generateActionPlanReport(
  input: ActionPlanReportInput,
): Promise<jsPDF> {
  const { plan, actions, orgName, campagneName, lang = 'fr' } = input
  const L = LABELS[lang]
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const meta: PdfMeta = {
    title: `Action Plan - ${orgName}`,
    documentId: `PLAN-${plan.id.substring(0, 8).toUpperCase()}`,
    version: 'V3.0',
    date: new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    confidential: false,
  }

  let pageCount = 0

  function newPage(): void {
    if (pageCount > 0) doc.addPage()
    pageCount++
    drawHeader(doc, meta)
  }

  function currentY(): number {
    return pdfLayout.marginTop + (pageCount === 1 ? 5 : 0)
  }

  // Stats
  const total = actions.length
  const completed = actions.filter(a => a.statut === 'termine').length
  const inProgress = actions.filter(a => a.statut === 'en_cours').length
  const blocked = actions.filter(a => a.statut === 'bloque').length
  const todo = actions.filter(a => a.statut === 'a_faire').length
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

  // ── Section 1: Summary ──────────────────────────────────────────────────

  newPage()
  let y = currentY()

  doc.setTextColor(pdfColors.primary)
  doc.setFontSize(pdfFontSize.label)
  doc.setFont(pdfFonts.body, 'bold')
  doc.text(`${L.section} 01`, pdfLayout.marginLeft, y)
  doc.setFontSize(pdfFontSize.h1)
  doc.setFont(pdfFonts.headline, 'bold')
  doc.text(L.summary, pdfLayout.marginLeft + 25, y)

  y += 3
  doc.setDrawColor(pdfColors.secondary)
  doc.setLineWidth(0.8)
  doc.line(pdfLayout.marginLeft + 25, y, pdfLayout.marginLeft + 29, y)

  y += 10

  // Summary box
  doc.setFillColor(pdfColors.surfaceContainer)
  doc.roundedRect(pdfLayout.marginLeft, y, pdfContentWidth, 30, 2, 2, 'F')

  doc.setTextColor(pdfColors.onSurfaceVariant)
  doc.setFontSize(pdfFontSize.caption)
  doc.setFont(pdfFonts.body, 'normal')
  doc.text(`${L.organisation}: ${orgName}`, pdfLayout.marginLeft + 5, y + 8)
  doc.text(`${L.campaign}: ${campagneName}`, pdfLayout.marginLeft + 5, y + 14)
  doc.text(`${L.dateGenerated}: ${meta.date}`, pdfLayout.marginLeft + 5, y + 20)

  // Completion donut substitute — text
  const cX = pdfLayout.pageWidth - pdfLayout.marginRight - 30
  doc.setTextColor(pdfColors.primary)
  doc.setFontSize(24)
  doc.setFont(pdfFonts.headline, 'bold')
  doc.text(`${completionRate}%`, cX, y + 14)
  doc.setFontSize(pdfFontSize.micro)
  doc.setFont(pdfFonts.body, 'normal')
  doc.text(L.completion, cX, y + 20)

  y += 40

  // KPI cards
  const kpiWidth = pdfContentWidth / 4
  const kpis = [
    { label: L.totalActions, value: String(total), color: pdfColors.primary },
    { label: L.completed, value: String(completed), color: pdfColors.scoreExcellent },
    { label: L.inProgress, value: String(inProgress), color: pdfColors.scoreCorrect },
    { label: L.blocked, value: String(blocked), color: pdfColors.scoreCritical },
  ]

  for (let i = 0; i < kpis.length; i++) {
    const kpi = kpis[i]!
    const kx = pdfLayout.marginLeft + i * kpiWidth

    doc.setFillColor(pdfColors.white)
    doc.roundedRect(kx + 1, y, kpiWidth - 2, 18, 1, 1, 'F')

    doc.setTextColor(kpi.color)
    doc.setFontSize(16)
    doc.setFont(pdfFonts.headline, 'bold')
    doc.text(kpi.value, kx + kpiWidth / 2, y + 10, { align: 'center' })

    doc.setTextColor(pdfColors.onSurfaceVariant)
    doc.setFontSize(pdfFontSize.micro)
    doc.setFont(pdfFonts.body, 'normal')
    doc.text(kpi.label, kx + kpiWidth / 2, y + 16, { align: 'center' })
  }

  y += 28

  // ── Section 2: Actions Table ────────────────────────────────────────────

  doc.setTextColor(pdfColors.primary)
  doc.setFontSize(pdfFontSize.label)
  doc.setFont(pdfFonts.body, 'bold')
  doc.text(`${L.section} 02`, pdfLayout.marginLeft, y)
  doc.setFontSize(pdfFontSize.h1)
  doc.setFont(pdfFonts.headline, 'bold')
  doc.text(L.actionsByStatus, pdfLayout.marginLeft + 25, y)

  y += 3
  doc.setDrawColor(pdfColors.secondary)
  doc.setLineWidth(0.8)
  doc.line(pdfLayout.marginLeft + 25, y, pdfLayout.marginLeft + 29, y)

  y += 8

  // Sort: blocked first, then in_progress, todo, completed
  const statusOrder: Record<string, number> = { bloque: 0, en_cours: 1, a_faire: 2, termine: 3 }
  const sortedActions = [...actions].sort(
    (a, b) => (statusOrder[a.statut] ?? 4) - (statusOrder[b.statut] ?? 4),
  )

  const tableRows = sortedActions.map(a => [
    a.critereCode ?? '-',
    a.objectif.length > 60 ? a.objectif.substring(0, 57) + '...' : a.objectif,
    a.responsable,
    formatTimestamp(a.dateEcheance),
    L.statusLabels[a.statut] ?? a.statut,
    L.priorityLabels[a.priorite] ?? a.priorite,
    a.kpis ?? '-',
  ])

  autoTable(doc, {
    startY: y,
    head: [[
      L.criterion,
      L.objective,
      L.responsible,
      L.dueDate,
      L.status,
      L.priority,
      L.kpis,
    ]],
    body: tableRows,
    ...pdfTableStyles,
    bodyStyles: {
      ...pdfTableStyles.bodyStyles,
      fontSize: pdfFontSize.caption,
    },
    columnStyles: {
      0: { cellWidth: 14 },
      1: { cellWidth: 45 },
      2: { cellWidth: 22 },
      3: { cellWidth: 18 },
      4: { cellWidth: 18 },
      5: { cellWidth: 15 },
      6: { cellWidth: pdfContentWidth - 132 },
    },
    didParseCell(data) {
      // Color status column
      if (data.section === 'body' && data.column.index === 4) {
        const statusValue = String(data.cell.raw)
        const action = sortedActions[data.row.index]
        if (action) {
          data.cell.styles.textColor = getStatusColor(action.statut)
          data.cell.styles.fontStyle = 'bold'
        }
      }
      // Color priority column
      if (data.section === 'body' && data.column.index === 5) {
        const action = sortedActions[data.row.index]
        if (action?.priorite === 'critique') {
          data.cell.styles.textColor = pdfColors.scoreCritical
          data.cell.styles.fontStyle = 'bold'
        } else if (action?.priorite === 'haute') {
          data.cell.styles.textColor = pdfColors.scoreWarning
          data.cell.styles.fontStyle = 'bold'
        }
      }
    },
    margin: { left: pdfLayout.marginLeft, right: pdfLayout.marginRight },
  })

  // ── Footers ─────────────────────────────────────────────────────────────

  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    drawFooter(doc, meta, i, totalPages)
  }

  return doc
}
