/**
 * PDF Theme — Design tokens adapted for jsPDF rendering.
 *
 * All sizes are in jsPDF points (1pt = 1/72 inch).
 * Colors are hex strings compatible with jsPDF and jspdf-autotable.
 */

// ── Colors — aligned with src/design/tokens.ts ─────────────────────────────

export const pdfColors = {
  // Primary
  primary:          '#15236e',
  primaryContainer: '#2e3b85',
  primaryLight:     '#dee0ff',

  // Secondary (success/green)
  secondary:          '#3b6934',
  secondaryContainer: '#b9eeab',

  // Error
  error:          '#ba1a1a',
  errorContainer: '#ffdad6',

  // Surfaces
  surface:            '#f8f9ff',
  surfaceContainer:   '#eaeef7',
  surfaceHigh:        '#e4e8f1',
  surfaceHighest:     '#dee3eb',
  white:              '#ffffff',

  // Text
  onSurface:        '#171c22',
  onSurfaceVariant: '#454651',
  outline:          '#767682',

  // Score semantics
  scoreExcellent: '#3b6934',
  scoreCorrect:   '#15236e',
  scoreWarning:   '#e97c00',
  scoreCritical:  '#ba1a1a',

  // Warning
  warning: '#F59E0B',

  // WOSM Brand
  wosmPurple:          '#4B2E83',
  wosmPurpleLight:     '#6B4FA3',
  wosmPurpleDark:      '#351F63',
  wosmPurpleContainer: '#EDE7F6',
  wosmYellow:          '#FDB714',
  wosmYellowLight:     '#FEEAB0',
  wosmYellowContainer: '#FFF8E1',
} as const

// ── Fonts ────────────────────────────────────────────────────────────────────

export const pdfFonts = {
  // jsPDF built-in fonts (no custom font embedding for now)
  body: 'helvetica',
  headline: 'helvetica',
} as const

// ── Font sizes (pt) ──────────────────────────────────────────────────────────

export const pdfFontSize = {
  title:     18,
  h1:        14,
  h2:        12,
  h3:        10,
  body:       9,
  caption:    8,
  label:      7,
  micro:      6,
} as const

// ── Margins & Layout (mm) ────────────────────────────────────────────────────

export const pdfLayout = {
  marginTop:    25,
  marginBottom: 20,
  marginLeft:   20,
  marginRight:  20,
  pageWidth:   210,   // A4
  pageHeight:  297,   // A4
  headerHeight: 20,
  footerHeight: 12,
  lineSpacing:   5,
  sectionGap:   10,
} as const

export const pdfContentWidth =
  pdfLayout.pageWidth - pdfLayout.marginLeft - pdfLayout.marginRight

// ── Score color helper ───────────────────────────────────────────────────────

export function getScoreColor(score: number): string {
  if (score >= 75) return pdfColors.scoreExcellent
  if (score >= 50) return pdfColors.scoreCorrect
  if (score >= 25) return pdfColors.scoreWarning
  return pdfColors.scoreCritical
}

export function getScoreBgColor(score: number): string {
  if (score >= 75) return pdfColors.secondaryContainer
  if (score >= 50) return pdfColors.primaryLight
  if (score >= 25) return '#fff3e0'
  return pdfColors.errorContainer
}

// ── Table styles for jspdf-autotable ─────────────────────────────────────────

export const pdfTableStyles = {
  headStyles: {
    fillColor: pdfColors.primary,
    textColor: pdfColors.white,
    fontStyle: 'bold' as const,
    fontSize: pdfFontSize.caption,
    cellPadding: 3,
    halign: 'left' as const,
  },
  bodyStyles: {
    textColor: pdfColors.onSurface,
    fontSize: pdfFontSize.body,
    cellPadding: 3,
    lineColor: pdfColors.surfaceHighest,
    lineWidth: 0.1,
  },
  alternateRowStyles: {
    fillColor: pdfColors.surfaceContainer,
  },
  styles: {
    font: pdfFonts.body,
    overflow: 'linebreak' as const,
  },
} as const

// ── Header/footer helpers ────────────────────────────────────────────────────

export interface PdfMeta {
  title: string
  documentId?: string
  version?: string
  date: string
  confidential?: boolean
}

/**
 * Draw the standard GSAT header on the current page.
 */
export function drawHeader(doc: import('jspdf').jsPDF, meta: PdfMeta): void {
  const { marginLeft, marginRight, pageWidth } = pdfLayout
  const contentRight = pageWidth - marginRight

  // Logo placeholder (WOSM icon as text)
  doc.setFillColor(pdfColors.primary)
  doc.rect(marginLeft, 8, 12, 12, 'F')
  doc.setTextColor(pdfColors.white)
  doc.setFontSize(pdfFontSize.caption)
  doc.setFont(pdfFonts.headline, 'bold')
  doc.text('WOSM', marginLeft + 2, 16)

  // Title
  doc.setTextColor(pdfColors.primary)
  doc.setFontSize(pdfFontSize.h2)
  doc.setFont(pdfFonts.headline, 'bold')
  doc.text('GSAT VALIDATION REPORT', marginLeft + 16, 15)

  // Right side: date and document ID
  doc.setTextColor(pdfColors.onSurfaceVariant)
  doc.setFontSize(pdfFontSize.micro)
  doc.setFont(pdfFonts.body, 'normal')
  doc.text(meta.date, contentRight, 11, { align: 'right' })
  if (meta.documentId) {
    doc.text(meta.documentId, contentRight, 15, { align: 'right' })
  }
  if (meta.version) {
    doc.text(`Ref: ${meta.version}`, contentRight, 19, { align: 'right' })
  }

  // Separator line
  doc.setDrawColor(pdfColors.primary)
  doc.setLineWidth(0.5)
  doc.line(marginLeft, pdfLayout.headerHeight + 2, contentRight, pdfLayout.headerHeight + 2)
}

/**
 * Draw the standard GSAT footer on the current page.
 */
export function drawFooter(
  doc: import('jspdf').jsPDF,
  meta: PdfMeta,
  pageNumber: number,
  totalPages: number,
): void {
  const { marginLeft, marginRight, pageWidth, pageHeight, footerHeight } = pdfLayout
  const contentRight = pageWidth - marginRight
  const y = pageHeight - footerHeight + 4

  doc.setDrawColor(pdfColors.surfaceHighest)
  doc.setLineWidth(0.3)
  doc.line(marginLeft, y - 4, contentRight, y - 4)

  doc.setTextColor(pdfColors.outline)
  doc.setFontSize(pdfFontSize.micro)
  doc.setFont(pdfFonts.body, 'normal')

  // Left: document ID + confidentiality
  const leftText = [meta.documentId, meta.confidential ? 'STRICTLY CONFIDENTIAL' : '']
    .filter(Boolean)
    .join(' | ')
  doc.text(leftText, marginLeft, y)

  // Right: page number
  doc.text(`Page ${pageNumber} / ${totalPages}`, contentRight, y, { align: 'right' })

  // Center: copyright
  const center = pageWidth / 2
  doc.text(`\u00A9 WOSM ${new Date().getFullYear()}`, center, y, { align: 'center' })
}
