/**
 * evaluationReport.ts
 *
 * Generates a full PDF report for a GSAT evaluation.
 * Sections:
 *   1. Executive Summary (global score, metadata)
 *   2. Dimension Scores (table)
 *   3. Critical Findings (essential criteria KO)
 *   4. Detailed Scores & Comments per dimension
 *   5. Approval Status
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
  getScoreColor,
  drawHeader,
  drawFooter,
  type PdfMeta,
} from './pdfTheme'
import type { Referentiel, DimensionDef, CritereDef, Score, Evaluation } from '@/types'
import {
  calculerScoreDimension,
  calculerScoreGlobal,
  getCriteresEssentiels,
} from '@/services/referentielService'

// ── Input ────────────────────────────────────────────────────────────────────

export interface EvaluationReportInput {
  evaluation: Evaluation
  referentiel: Referentiel
  scores: Score[]
  orgName: string
  campagneName: string
  validatorName?: string
  lang?: 'fr' | 'en'
}

// ── Labels ───────────────────────────────────────────────────────────────────

const LABELS = {
  fr: {
    executiveSummary: 'RESUME EXECUTIF',
    dimensionScores: 'SCORES PAR DIMENSION',
    criticalFindings: 'CONSTATS CRITIQUES',
    detailedScores: 'SCORES DETAILLES',
    approvalStatus: 'STATUT DE VALIDATION',
    dimension: 'Dimension',
    score: 'Score',
    status: 'Statut',
    criterion: 'Critere',
    rating: 'Note',
    comment: 'Commentaire',
    essential: 'Essentiel',
    na: 'N/A',
    globalScore: 'Score Global',
    organisation: 'Organisation',
    campaign: 'Campagne',
    evaluationType: 'Type',
    dateGenerated: 'Date de generation',
    noComment: '-',
    scoreLabels: { 0: 'Non-conforme', 1: 'Partiel', 2: 'Conforme', 3: 'Total' },
    approved: 'Validee',
    pending: 'En attente',
    draft: 'Brouillon',
    section: 'SECTION',
  },
  en: {
    executiveSummary: 'EXECUTIVE SUMMARY',
    dimensionScores: 'DIMENSION SCORES',
    criticalFindings: 'CRITICAL FINDINGS',
    detailedScores: 'DETAILED SCORES',
    approvalStatus: 'APPROVAL STATUS',
    dimension: 'Dimension',
    score: 'Score',
    status: 'Status',
    criterion: 'Criterion',
    rating: 'Rating',
    comment: 'Comment',
    essential: 'Essential',
    na: 'N/A',
    globalScore: 'Global Score',
    organisation: 'Organisation',
    campaign: 'Campaign',
    evaluationType: 'Type',
    dateGenerated: 'Date generated',
    noComment: '-',
    scoreLabels: { 0: 'Non-compliant', 1: 'Partial', 2: 'Compliant', 3: 'Full' },
    approved: 'Validated',
    pending: 'Pending',
    draft: 'Draft',
    section: 'SECTION',
  },
} as const

// ── Generator ────────────────────────────────────────────────────────────────

export async function generateEvaluationReport(
  input: EvaluationReportInput,
): Promise<jsPDF> {
  const {
    evaluation,
    referentiel,
    scores,
    orgName,
    campagneName,
    validatorName,
    lang = 'fr',
  } = input

  const L = LABELS[lang]
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // Build scores map
  const scoresMap: Record<string, number | null> = {}
  const commentsMap: Record<string, string> = {}
  for (const s of scores) {
    scoresMap[s.critereCode] = s.note
    if (s.commentaire) {
      commentsMap[s.critereCode] = s.commentaire
    }
  }

  // Calculate dimension scores
  const dimScores: Record<string, number> = {}
  for (const dim of referentiel.dimensions) {
    dimScores[dim.code] = calculerScoreDimension(scoresMap, dim)
  }
  const globalScore = calculerScoreGlobal(scoresMap, referentiel)

  // Essential KOs
  const essentiels = getCriteresEssentiels(referentiel)
  const essentielsKO = essentiels.filter(c => (scoresMap[c.code] ?? 0) === 0)

  // Meta
  const meta: PdfMeta = {
    title: `GSAT Evaluation - ${orgName}`,
    documentId: `GSAT-${evaluation.id.substring(0, 8).toUpperCase()}`,
    version: `V${referentiel.version}`,
    date: new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    confidential: true,
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

  // ── Section 1: Executive Summary ────────────────────────────────────────

  newPage()
  let y = currentY()

  // Section label
  doc.setTextColor(pdfColors.primary)
  doc.setFontSize(pdfFontSize.label)
  doc.setFont(pdfFonts.body, 'bold')
  doc.text(`${L.section} 01`, pdfLayout.marginLeft, y)

  // Title
  doc.setFontSize(pdfFontSize.h1)
  doc.setFont(pdfFonts.headline, 'bold')
  doc.text(L.executiveSummary, pdfLayout.marginLeft + 25, y)

  y += 3
  // Green accent line
  doc.setDrawColor(pdfColors.secondary)
  doc.setLineWidth(0.8)
  doc.line(pdfLayout.marginLeft + 25, y, pdfLayout.marginLeft + 29, y)

  y += 10

  // Summary box
  doc.setFillColor(pdfColors.surfaceContainer)
  doc.roundedRect(pdfLayout.marginLeft, y, pdfContentWidth, 35, 2, 2, 'F')

  // Org name and campaign
  doc.setTextColor(pdfColors.onSurfaceVariant)
  doc.setFontSize(pdfFontSize.caption)
  doc.setFont(pdfFonts.body, 'normal')
  doc.text(`${L.organisation}: ${orgName}`, pdfLayout.marginLeft + 5, y + 8)
  doc.text(`${L.campaign}: ${campagneName}`, pdfLayout.marginLeft + 5, y + 14)
  doc.text(`${L.dateGenerated}: ${meta.date}`, pdfLayout.marginLeft + 5, y + 20)

  // Global score (right side)
  const scoreX = pdfLayout.pageWidth - pdfLayout.marginRight - 30
  doc.setTextColor(pdfColors.primary)
  doc.setFontSize(28)
  doc.setFont(pdfFonts.headline, 'bold')
  doc.text(`${globalScore}%`, scoreX, y + 16)
  doc.setFontSize(pdfFontSize.micro)
  doc.setFont(pdfFonts.body, 'normal')
  doc.text(L.globalScore, scoreX, y + 22)

  // Score bar
  const barY = y + 27
  const barWidth = 40
  doc.setFillColor(pdfColors.surfaceHighest)
  doc.rect(scoreX - 5, barY, barWidth, 2, 'F')
  doc.setFillColor(getScoreColor(globalScore))
  doc.rect(scoreX - 5, barY, barWidth * (globalScore / 100), 2, 'F')

  y += 45

  // ── Section 2: Dimension Scores ─────────────────────────────────────────

  doc.setTextColor(pdfColors.primary)
  doc.setFontSize(pdfFontSize.label)
  doc.setFont(pdfFonts.body, 'bold')
  doc.text(`${L.section} 02`, pdfLayout.marginLeft, y)
  doc.setFontSize(pdfFontSize.h1)
  doc.setFont(pdfFonts.headline, 'bold')
  doc.text(L.dimensionScores, pdfLayout.marginLeft + 25, y)

  y += 3
  doc.setDrawColor(pdfColors.secondary)
  doc.setLineWidth(0.8)
  doc.line(pdfLayout.marginLeft + 25, y, pdfLayout.marginLeft + 29, y)

  y += 8

  const dimTableData = referentiel.dimensions.map((dim: DimensionDef) => {
    const score = dimScores[dim.code] ?? 0
    return [
      `${dim.code}. ${dim.nom[lang]}`,
      `${score}%`,
    ]
  })

  autoTable(doc, {
    startY: y,
    head: [[L.dimension, L.score]],
    body: dimTableData,
    ...pdfTableStyles,
    columnStyles: {
      0: { cellWidth: pdfContentWidth - 25 },
      1: { cellWidth: 25, halign: 'right' as const, fontStyle: 'bold' as const },
    },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 1) {
        const scoreStr = String(data.cell.raw).replace('%', '')
        const score = parseInt(scoreStr, 10)
        data.cell.styles.textColor = getScoreColor(score)
      }
    },
    margin: { left: pdfLayout.marginLeft, right: pdfLayout.marginRight },
  })

  // ── Section 3: Critical Findings ────────────────────────────────────────

  // Get Y after table
  const afterDimTable = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 60
  y = afterDimTable + pdfLayout.sectionGap

  // Check if we need a new page
  if (y > pdfLayout.pageHeight - 80) {
    newPage()
    y = currentY()
  }

  doc.setTextColor(pdfColors.primary)
  doc.setFontSize(pdfFontSize.label)
  doc.setFont(pdfFonts.body, 'bold')
  doc.text(`${L.section} 03`, pdfLayout.marginLeft, y)
  doc.setFontSize(pdfFontSize.h1)
  doc.setFont(pdfFonts.headline, 'bold')
  doc.text(L.criticalFindings, pdfLayout.marginLeft + 25, y)

  y += 3
  doc.setDrawColor(pdfColors.secondary)
  doc.setLineWidth(0.8)
  doc.line(pdfLayout.marginLeft + 25, y, pdfLayout.marginLeft + 29, y)

  y += 8

  if (essentielsKO.length === 0) {
    doc.setTextColor(pdfColors.secondary)
    doc.setFontSize(pdfFontSize.body)
    doc.setFont(pdfFonts.body, 'normal')
    doc.text('No critical findings.', pdfLayout.marginLeft, y)
    y += 10
  } else {
    for (const critere of essentielsKO) {
      if (y > pdfLayout.pageHeight - 40) {
        newPage()
        y = currentY()
      }

      // Red left border
      doc.setFillColor(pdfColors.error)
      doc.rect(pdfLayout.marginLeft, y - 2, 1.5, 14, 'F')

      // Background
      doc.setFillColor('#fef2f2')
      doc.roundedRect(pdfLayout.marginLeft + 2, y - 2, pdfContentWidth - 2, 14, 1, 1, 'F')

      doc.setTextColor(pdfColors.error)
      doc.setFontSize(pdfFontSize.caption)
      doc.setFont(pdfFonts.headline, 'bold')
      doc.text(`${L.essential} ${critere.code}`, pdfLayout.marginLeft + 5, y + 3)

      doc.setTextColor(pdfColors.onSurface)
      doc.setFontSize(pdfFontSize.body)
      doc.setFont(pdfFonts.body, 'normal')

      const label = critere.libelle[lang]
      const lines = doc.splitTextToSize(label, pdfContentWidth - 15)
      doc.text(lines[0] ?? '', pdfLayout.marginLeft + 5, y + 9)

      y += 18
    }
  }

  // ── Section 4: Detailed Scores ──────────────────────────────────────────

  for (const dim of referentiel.dimensions) {
    if (y > pdfLayout.pageHeight - 60) {
      newPage()
      y = currentY()
    }

    // Dimension header
    doc.setTextColor(pdfColors.primary)
    doc.setFontSize(pdfFontSize.h3)
    doc.setFont(pdfFonts.headline, 'bold')
    doc.text(`${dim.code} — ${dim.nom[lang]}`, pdfLayout.marginLeft, y)

    const dimScore = dimScores[dim.code] ?? 0
    doc.setTextColor(getScoreColor(dimScore))
    doc.text(`${dimScore}%`, pdfLayout.pageWidth - pdfLayout.marginRight, y, { align: 'right' })

    y += 6

    const critereRows = dim.criteres
      .filter((c: CritereDef) => c.actif)
      .map((c: CritereDef) => {
        const note = scoresMap[c.code]
        const noteStr = note === null || note === undefined
          ? L.na
          : `${note}/3`
        const comment = commentsMap[c.code] ?? L.noComment
        const essLabel = c.essentiel ? L.essential : ''
        return [c.code, c.libelle[lang], essLabel, noteStr, comment]
      })

    autoTable(doc, {
      startY: y,
      head: [[L.criterion.substring(0, 4) + '.', L.criterion, L.essential, L.rating, L.comment]],
      body: critereRows,
      ...pdfTableStyles,
      headStyles: {
        ...pdfTableStyles.headStyles,
        fontSize: pdfFontSize.label,
      },
      bodyStyles: {
        ...pdfTableStyles.bodyStyles,
        fontSize: pdfFontSize.caption,
      },
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 55 },
        2: { cellWidth: 15, halign: 'center' as const },
        3: { cellWidth: 12, halign: 'center' as const, fontStyle: 'bold' as const },
        4: { cellWidth: pdfContentWidth - 94 },
      },
      didParseCell(data) {
        // Color essential badge
        if (data.section === 'body' && data.column.index === 2 && data.cell.raw) {
          data.cell.styles.textColor = pdfColors.error
          data.cell.styles.fontStyle = 'bold'
        }
        // Color score
        if (data.section === 'body' && data.column.index === 3) {
          const raw = String(data.cell.raw)
          if (raw !== L.na) {
            const val = parseInt(raw, 10)
            if (val === 0) data.cell.styles.textColor = pdfColors.scoreCritical
            else if (val === 1) data.cell.styles.textColor = pdfColors.scoreWarning
            else data.cell.styles.textColor = pdfColors.scoreExcellent
          }
        }
      },
      margin: { left: pdfLayout.marginLeft, right: pdfLayout.marginRight },
    })

    const afterTable = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 30
    y = afterTable + 8
  }

  // ── Apply footers to all pages ──────────────────────────────────────────

  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    drawFooter(doc, meta, i, totalPages)
  }

  return doc
}
