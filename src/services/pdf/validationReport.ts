/**
 * validationReport.ts
 *
 * Generates a formal GSAT Validation Report PDF.
 * Sections:
 *   1. Cover page with WOSM branding, document ID, seal
 *   2. Executive Summary (global score + summary text)
 *   3. Dimension Scores (2-column grid of 10 dimensions)
 *   4. Critical Findings (essential criteria KO)
 *   5. Approval Status (validator, signature, status badge)
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

export type ValidationStatus = 'approved' | 'approved_with_conditions' | 'rejected'

export interface ValidatorInfo {
  name: string
  role: string
  email: string
  date?: string | undefined
  conclusion?: string | undefined
}

export interface ValidationReportInput {
  evaluation: Evaluation
  referentiel: Referentiel
  scores: Score[]
  orgName: string
  campagneName: string
  validator: ValidatorInfo
  validationStatus: ValidationStatus
  lang?: 'fr' | 'en'
}

// ── Labels ───────────────────────────────────────────────────────────────────

const LABELS = {
  fr: {
    reportTitle: 'RAPPORT DE VALIDATION GSAT',
    officialDocument: 'Document Officiel',
    section: 'SECTION',
    executiveSummary: 'RESUME EXECUTIF',
    dimensionScores: 'SCORES PAR DIMENSION',
    criticalFindings: 'CONSTATS CRITIQUES',
    approvalStatus: 'STATUT DE VALIDATION',
    dimension: 'Dimension',
    score: 'Score',
    essential: 'Essentiel',
    globalScore: 'Score Global',
    organisation: 'Organisation',
    campaign: 'Campagne',
    dateGenerated: 'Date d\'emission',
    documentId: 'ID Document',
    noCriticalFindings: 'Aucun constat critique — tous les criteres essentiels sont conformes.',
    impactLabel: 'Impact',
    impactText: 'Ce critere essentiel non conforme peut affecter la validation globale.',
    approved: 'Approuvee',
    approvedWithConditions: 'Approuvee avec reserves',
    rejected: 'Rejetee',
    validatedBy: 'Valide par',
    validatorRole: 'Fonction',
    validationDate: 'Date de validation',
    digitalSignature: 'Signature numerique',
    signatureNote: 'Ce document a ete valide electroniquement.',
    conclusion: 'Conclusion',
    confidential: 'STRICTEMENT CONFIDENTIEL',
    summaryText: 'Cette evaluation a ete realisee conformement au referentiel GSAT V3.0 de l\'Organisation Mondiale du Mouvement Scout (OMMS). Le score global reflete le niveau de maturite organisationnelle de l\'association evaluee.',
    officialSeal: 'Sceau Officiel OMMS',
  },
  en: {
    reportTitle: 'GSAT VALIDATION REPORT',
    officialDocument: 'Official Document',
    section: 'SECTION',
    executiveSummary: 'EXECUTIVE SUMMARY',
    dimensionScores: 'DIMENSION SCORES',
    criticalFindings: 'CRITICAL FINDINGS',
    approvalStatus: 'APPROVAL STATUS',
    dimension: 'Dimension',
    score: 'Score',
    essential: 'Essential',
    globalScore: 'Global Score',
    organisation: 'Organisation',
    campaign: 'Campaign',
    dateGenerated: 'Date of issue',
    documentId: 'Document ID',
    noCriticalFindings: 'No critical findings — all essential criteria are compliant.',
    impactLabel: 'Impact',
    impactText: 'This non-compliant essential criterion may affect the overall validation.',
    approved: 'Approved',
    approvedWithConditions: 'Approved with Conditions',
    rejected: 'Rejected',
    validatedBy: 'Validated by',
    validatorRole: 'Role',
    validationDate: 'Validation date',
    digitalSignature: 'Digital signature',
    signatureNote: 'This document has been validated electronically.',
    conclusion: 'Conclusion',
    confidential: 'STRICTLY CONFIDENTIAL',
    summaryText: 'This evaluation was conducted in accordance with the GSAT V3.0 framework of the World Organization of the Scout Movement (WOSM). The global score reflects the organisational maturity level of the assessed association.',
    officialSeal: 'WOSM Official Seal',
  },
} as const

type Labels = typeof LABELS['fr'] | typeof LABELS['en']

// ── Helpers ──────────────────────────────────────────────────────────────────

function getStatusColor(status: ValidationStatus): string {
  switch (status) {
    case 'approved': return pdfColors.scoreExcellent
    case 'approved_with_conditions': return pdfColors.scoreWarning
    case 'rejected': return pdfColors.scoreCritical
  }
}

function getStatusLabel(status: ValidationStatus, L: Labels): string {
  switch (status) {
    case 'approved': return L.approved
    case 'approved_with_conditions': return L.approvedWithConditions
    case 'rejected': return L.rejected
  }
}

function drawSectionHeader(
  doc: jsPDF,
  sectionNumber: string,
  title: string,
  y: number,
  sectionLabel: string,
): number {
  doc.setTextColor(pdfColors.wosmPurple)
  doc.setFontSize(pdfFontSize.label)
  doc.setFont(pdfFonts.body, 'bold')
  doc.text(`${sectionLabel} ${sectionNumber}`, pdfLayout.marginLeft, y)

  doc.setFontSize(pdfFontSize.h1)
  doc.setFont(pdfFonts.headline, 'bold')
  doc.text(title, pdfLayout.marginLeft + 25, y)

  y += 3
  doc.setDrawColor(pdfColors.wosmYellow)
  doc.setLineWidth(1)
  doc.line(pdfLayout.marginLeft + 25, y, pdfLayout.marginLeft + 45, y)

  return y + 8
}

// ── Generator ────────────────────────────────────────────────────────────────

export async function generateValidationReportPdf(
  input: ValidationReportInput,
): Promise<jsPDF> {
  const {
    evaluation,
    referentiel,
    scores,
    orgName,
    campagneName,
    validator,
    validationStatus,
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

  // Calculate scores
  const dimScores: Record<string, number | null> = {}
  for (const dim of referentiel.dimensions) {
    dimScores[dim.code] = calculerScoreDimension(scoresMap, dim)
  }
  const globalScore = calculerScoreGlobal(scoresMap, referentiel)

  // Essential KOs
  const essentiels = getCriteresEssentiels(referentiel)
  const essentielsKO = essentiels.filter(c => (scoresMap[c.code] ?? 0) === 0)

  // Meta
  const documentId = `GSAT-${evaluation.id.substring(0, 8).toUpperCase()}`
  const dateStr = validator.date ?? new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const meta: PdfMeta = {
    title: L.reportTitle,
    documentId,
    version: `V${referentiel.version}`,
    date: dateStr,
    confidential: true,
  }

  let pageCount = 0

  function newPage(): void {
    if (pageCount > 0) doc.addPage()
    pageCount++
    drawValidationHeader(doc, meta, L)
  }

  function currentY(): number {
    return pdfLayout.marginTop + 5
  }

  function checkPageBreak(y: number, needed: number): number {
    if (y + needed > pdfLayout.pageHeight - pdfLayout.marginBottom - pdfLayout.footerHeight) {
      newPage()
      return currentY()
    }
    return y
  }

  // ── Cover / Page 1 ─────────────────────────────────────────────────────────

  newPage()
  let y = currentY()

  // ── Section 1: Executive Summary ───────────────────────────────────────────

  y = drawSectionHeader(doc, '01', L.executiveSummary, y, L.section)

  // Summary text box (left 2/3)
  const textBoxWidth = pdfContentWidth * 0.62
  const scoreBoxWidth = pdfContentWidth * 0.35
  const scoreBoxX = pdfLayout.marginLeft + textBoxWidth + pdfContentWidth * 0.03

  doc.setFillColor(pdfColors.surfaceContainer)
  doc.roundedRect(pdfLayout.marginLeft, y, textBoxWidth, 45, 2, 2, 'F')

  doc.setTextColor(pdfColors.onSurface)
  doc.setFontSize(pdfFontSize.body)
  doc.setFont(pdfFonts.body, 'normal')
  const summaryLines = doc.splitTextToSize(L.summaryText, textBoxWidth - 10)
  doc.text(summaryLines, pdfLayout.marginLeft + 5, y + 8)

  // Org and campaign info
  doc.setTextColor(pdfColors.onSurfaceVariant)
  doc.setFontSize(pdfFontSize.caption)
  doc.text(`${L.organisation}: ${orgName}`, pdfLayout.marginLeft + 5, y + 30)
  doc.text(`${L.campaign}: ${campagneName}`, pdfLayout.marginLeft + 5, y + 36)
  doc.text(`${L.dateGenerated}: ${dateStr}`, pdfLayout.marginLeft + 5, y + 42)

  // Score card (right 1/3)
  doc.setFillColor(pdfColors.wosmPurple)
  doc.roundedRect(scoreBoxX, y, scoreBoxWidth, 45, 2, 2, 'F')

  // Score value
  doc.setTextColor(pdfColors.white)
  doc.setFontSize(32)
  doc.setFont(pdfFonts.headline, 'bold')
  doc.text(`${globalScore}%`, scoreBoxX + scoreBoxWidth / 2, y + 20, { align: 'center' })

  // Score label
  doc.setFontSize(pdfFontSize.caption)
  doc.setFont(pdfFonts.body, 'normal')
  doc.text(L.globalScore, scoreBoxX + scoreBoxWidth / 2, y + 28, { align: 'center' })

  // Score bar
  const barX = scoreBoxX + 8
  const barWidth = scoreBoxWidth - 16
  const barY = y + 34
  doc.setFillColor('#7B6BA3')
  doc.rect(barX, barY, barWidth, 3, 'F')
  doc.setFillColor(pdfColors.wosmYellow)
  doc.rect(barX, barY, barWidth * (globalScore / 100), 3, 'F')

  y += 55

  // ── Section 2: Dimension Scores ────────────────────────────────────────────

  y = checkPageBreak(y, 80)
  y = drawSectionHeader(doc, '02', L.dimensionScores, y, L.section)

  // Dimension grid as 2-column cards
  const colWidth = (pdfContentWidth - 6) / 2
  const cardHeight = 16

  for (let i = 0; i < referentiel.dimensions.length; i++) {
    const dim = referentiel.dimensions[i]!
    const col = i % 2
    const row = Math.floor(i / 2)

    if (col === 0 && i > 0) {
      // Check if we need more space
      y = checkPageBreak(y, 0)
    }

    const cardX = pdfLayout.marginLeft + col * (colWidth + 6)
    const cardY = y + row * (cardHeight + 4)

    // Check page break for the card
    if (cardY + cardHeight > pdfLayout.pageHeight - pdfLayout.marginBottom - pdfLayout.footerHeight) {
      newPage()
      y = currentY()
      // Recalculate with reset y
      const newRow = Math.floor(i / 2) - Math.floor(i / 2)
      const newCardY = y + newRow * (cardHeight + 4)
      drawDimensionCard(doc, dim, dimScores[dim.code] ?? 0, cardX, newCardY, colWidth, cardHeight, lang)
      continue
    }

    drawDimensionCard(doc, dim, dimScores[dim.code] ?? 0, cardX, cardY, colWidth, cardHeight, lang)
  }

  // Move Y past the grid
  const gridRows = Math.ceil(referentiel.dimensions.length / 2)
  y += gridRows * (cardHeight + 4) + 8

  // ── Section 3: Critical Findings ───────────────────────────────────────────

  y = checkPageBreak(y, 40)
  y = drawSectionHeader(doc, '03', L.criticalFindings, y, L.section)

  if (essentielsKO.length === 0) {
    doc.setTextColor(pdfColors.scoreExcellent)
    doc.setFontSize(pdfFontSize.body)
    doc.setFont(pdfFonts.body, 'normal')
    doc.text(L.noCriticalFindings, pdfLayout.marginLeft, y)
    y += 12
  } else {
    for (const critere of essentielsKO) {
      y = checkPageBreak(y, 22)

      // Red left border
      doc.setFillColor(pdfColors.error)
      doc.rect(pdfLayout.marginLeft, y - 2, 1.5, 18, 'F')

      // Background
      doc.setFillColor(pdfColors.errorContainer)
      doc.roundedRect(pdfLayout.marginLeft + 2, y - 2, pdfContentWidth - 2, 18, 1, 1, 'F')

      // Warning icon placeholder
      doc.setTextColor(pdfColors.error)
      doc.setFontSize(pdfFontSize.body)
      doc.setFont(pdfFonts.headline, 'bold')
      doc.text('!', pdfLayout.marginLeft + 6, y + 4)

      // Criterion code and title
      doc.setTextColor(pdfColors.error)
      doc.setFontSize(pdfFontSize.caption)
      doc.setFont(pdfFonts.headline, 'bold')
      doc.text(`${L.essential} ${critere.code}`, pdfLayout.marginLeft + 12, y + 3)

      doc.setTextColor(pdfColors.onSurface)
      doc.setFontSize(pdfFontSize.body)
      doc.setFont(pdfFonts.body, 'normal')
      const label = critere.libelle[lang]
      const lines = doc.splitTextToSize(label, pdfContentWidth - 20)
      doc.text(lines[0] ?? '', pdfLayout.marginLeft + 12, y + 9)

      // Impact line
      doc.setTextColor(pdfColors.onSurfaceVariant)
      doc.setFontSize(pdfFontSize.label)
      doc.text(`${L.impactLabel}: ${L.impactText}`, pdfLayout.marginLeft + 12, y + 14)

      y += 24
    }
  }

  // ── Section 4: Approval Status ─────────────────────────────────────────────

  y = checkPageBreak(y, 70)
  y = drawSectionHeader(doc, '04', L.approvalStatus, y, L.section)

  // Status badge
  const statusColor = getStatusColor(validationStatus)
  const statusLabel = getStatusLabel(validationStatus, L)

  doc.setFillColor(statusColor)
  doc.roundedRect(pdfLayout.marginLeft, y, pdfContentWidth, 14, 2, 2, 'F')
  doc.setTextColor(pdfColors.white)
  doc.setFontSize(pdfFontSize.h2)
  doc.setFont(pdfFonts.headline, 'bold')
  doc.text(statusLabel, pdfLayout.pageWidth / 2, y + 9, { align: 'center' })

  y += 22

  // Validator info box
  doc.setFillColor(pdfColors.surfaceContainer)
  doc.roundedRect(pdfLayout.marginLeft, y, pdfContentWidth, 40, 2, 2, 'F')

  doc.setTextColor(pdfColors.onSurface)
  doc.setFontSize(pdfFontSize.body)
  doc.setFont(pdfFonts.body, 'bold')
  doc.text(`${L.validatedBy}:`, pdfLayout.marginLeft + 5, y + 8)
  doc.setFont(pdfFonts.body, 'normal')
  doc.text(validator.name, pdfLayout.marginLeft + 40, y + 8)

  doc.setFont(pdfFonts.body, 'bold')
  doc.text(`${L.validatorRole}:`, pdfLayout.marginLeft + 5, y + 15)
  doc.setFont(pdfFonts.body, 'normal')
  doc.text(validator.role, pdfLayout.marginLeft + 40, y + 15)

  doc.setFont(pdfFonts.body, 'bold')
  doc.text(`${L.validationDate}:`, pdfLayout.marginLeft + 5, y + 22)
  doc.setFont(pdfFonts.body, 'normal')
  doc.text(dateStr, pdfLayout.marginLeft + 40, y + 22)

  // Digital signature area
  doc.setDrawColor(pdfColors.outline)
  doc.setLineWidth(0.3)
  doc.roundedRect(pdfLayout.marginLeft + 5, y + 28, 60, 8, 1, 1, 'S')

  doc.setTextColor(pdfColors.outline)
  doc.setFontSize(pdfFontSize.micro)
  doc.text(L.digitalSignature, pdfLayout.marginLeft + 8, y + 33)

  // Signature note (right side)
  doc.setTextColor(pdfColors.onSurfaceVariant)
  doc.setFontSize(pdfFontSize.label)
  doc.text(L.signatureNote, pdfLayout.marginLeft + 75, y + 33)

  y += 48

  // Conclusion (if provided)
  if (validator.conclusion) {
    y = checkPageBreak(y, 30)

    doc.setTextColor(pdfColors.wosmPurple)
    doc.setFontSize(pdfFontSize.h3)
    doc.setFont(pdfFonts.headline, 'bold')
    doc.text(L.conclusion, pdfLayout.marginLeft, y)
    y += 6

    doc.setTextColor(pdfColors.onSurface)
    doc.setFontSize(pdfFontSize.body)
    doc.setFont(pdfFonts.body, 'normal')
    const conclusionLines = doc.splitTextToSize(validator.conclusion, pdfContentWidth - 10)
    doc.text(conclusionLines, pdfLayout.marginLeft, y)
    y += conclusionLines.length * 4 + 6
  }

  // ── Apply footers to all pages ─────────────────────────────────────────────

  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    drawFooter(doc, meta, i, totalPages)
  }

  return doc
}

// ── Private helpers ──────────────────────────────────────────────────────────

function drawValidationHeader(doc: jsPDF, meta: PdfMeta, L: Labels): void {
  const { marginLeft, marginRight, pageWidth } = pdfLayout
  const contentRight = pageWidth - marginRight

  // WOSM purple accent bar at top
  doc.setFillColor(pdfColors.wosmPurple)
  doc.rect(0, 0, pageWidth, 4, 'F')

  // Logo placeholder
  doc.setFillColor(pdfColors.wosmPurple)
  doc.rect(marginLeft, 8, 12, 12, 'F')
  doc.setTextColor(pdfColors.white)
  doc.setFontSize(pdfFontSize.caption)
  doc.setFont(pdfFonts.headline, 'bold')
  doc.text('WOSM', marginLeft + 1.5, 16)

  // Title
  doc.setTextColor(pdfColors.wosmPurple)
  doc.setFontSize(pdfFontSize.h2)
  doc.setFont(pdfFonts.headline, 'bold')
  doc.text(L.reportTitle, marginLeft + 16, 15)

  // Right side info
  doc.setTextColor(pdfColors.onSurfaceVariant)
  doc.setFontSize(pdfFontSize.micro)
  doc.setFont(pdfFonts.body, 'normal')
  doc.text(meta.date, contentRight, 10, { align: 'right' })
  if (meta.documentId) {
    doc.text(meta.documentId, contentRight, 14, { align: 'right' })
  }

  // Official document badge
  doc.setFillColor(pdfColors.wosmYellow)
  doc.roundedRect(contentRight - 30, 16, 30, 5, 1, 1, 'F')
  doc.setTextColor(pdfColors.wosmPurpleDark)
  doc.setFontSize(pdfFontSize.label)
  doc.setFont(pdfFonts.headline, 'bold')
  doc.text(L.officialDocument, contentRight - 15, 19.5, { align: 'center' })

  // Separator
  doc.setDrawColor(pdfColors.wosmPurple)
  doc.setLineWidth(0.5)
  doc.line(marginLeft, pdfLayout.headerHeight + 2, contentRight, pdfLayout.headerHeight + 2)

  // Yellow accent line below
  doc.setDrawColor(pdfColors.wosmYellow)
  doc.setLineWidth(0.8)
  doc.line(marginLeft, pdfLayout.headerHeight + 3, marginLeft + 20, pdfLayout.headerHeight + 3)
}

function drawDimensionCard(
  doc: jsPDF,
  dim: DimensionDef,
  score: number,
  x: number,
  y: number,
  width: number,
  height: number,
  lang: 'fr' | 'en',
): void {
  // Card background
  doc.setFillColor(pdfColors.surfaceContainer)
  doc.roundedRect(x, y, width, height, 1.5, 1.5, 'F')

  // Dimension number
  doc.setTextColor(pdfColors.wosmPurple)
  doc.setFontSize(pdfFontSize.label)
  doc.setFont(pdfFonts.body, 'bold')
  doc.text(dim.code, x + 4, y + 5)

  // Dimension name
  doc.setTextColor(pdfColors.onSurface)
  doc.setFontSize(pdfFontSize.caption)
  doc.setFont(pdfFonts.body, 'normal')
  const dimName = dim.nom[lang]
  const truncatedName = dimName.length > 40 ? dimName.substring(0, 37) + '...' : dimName
  doc.text(truncatedName, x + 4, y + 11)

  // Score value (right aligned)
  const scoreColor = getScoreColor(score)
  doc.setTextColor(scoreColor)
  doc.setFontSize(pdfFontSize.h2)
  doc.setFont(pdfFonts.headline, 'bold')
  doc.text(`${score}%`, x + width - 4, y + 10, { align: 'right' })
}
