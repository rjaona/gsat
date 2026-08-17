/**
 * indiceReport.ts — Rapport PDF de l'Indice de Déploiement (§6).
 *
 * Deux sections : (1) table nationale par critère (écart note nationale ↔ ID) ;
 * (2) comparaison par Faritany (ID global + par dimension) regroupée par
 * province. La section 2 a ~13 colonnes → page en PAYSAGE.
 *
 * Retourne le doc jsPDF (l'appelant fait `.save(...)`), comme les autres
 * générateurs PDF du projet (patron `prepSheet.ts`).
 */

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { pdfColors, pdfFonts, pdfFontSize, pdfLayout, pdfTableStyles } from './pdfTheme'
import { grouperAsnParProvince, type LigneAsn } from '@/utils/asnTableau'
import type { IndiceCritereNational } from '@/services/indice/calculerIndiceDeploiement'

/** Libellés FR des bandes d'interprétation (miroir de i18n `pages.indice.interpretation`). */
const INTERP_FR: Record<NonNullable<IndiceCritereNational['interpretation']>, string> = {
  alerte: 'Déploiement défaillant',
  coherent: 'Cohérent',
  bonne_pratique: 'Bonne pratique locale',
}

export interface IndiceReportInput {
  national: IndiceCritereNational[]
  faritany: LigneAsn[]
  dimensionCodes: string[]
  niveauLabel?: string | undefined
  date?: string | undefined
}

function finalY(doc: jsPDF, fallback: number): number {
  return (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? fallback
}

export function generateIndiceReport(input: IndiceReportInput): jsPDF {
  const { national, faritany, dimensionCodes } = input
  const niveauLabel = input.niveauLabel ?? 'Faritany'
  const date = input.date ?? new Date().toLocaleDateString('fr-FR')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const { marginLeft, marginRight, pageWidth } = pdfLayout
  const contentRight = pageWidth - marginRight

  // ── En-tête ──
  doc.setFillColor(pdfColors.primary)
  doc.rect(marginLeft, 10, 12, 12, 'F')
  doc.setTextColor(pdfColors.white)
  doc.setFontSize(pdfFontSize.caption)
  doc.setFont(pdfFonts.headline, 'bold')
  doc.text('WOSM', marginLeft + 1.5, 17)

  doc.setTextColor(pdfColors.primary)
  doc.setFontSize(pdfFontSize.h1)
  doc.text('Indice de déploiement — GSAT-Faritany', marginLeft + 16, 15)
  doc.setTextColor(pdfColors.onSurfaceVariant)
  doc.setFontSize(pdfFontSize.caption)
  doc.setFont(pdfFonts.body, 'normal')
  doc.text(date, marginLeft + 16, 21)

  doc.setDrawColor(pdfColors.primary)
  doc.setLineWidth(0.5)
  doc.line(marginLeft, 25, contentRight, 25)

  // ── Section 1 : table nationale par critère ──
  doc.setTextColor(pdfColors.primary)
  doc.setFontSize(pdfFontSize.h2)
  doc.setFont(pdfFonts.headline, 'bold')
  doc.text('Table nationale par critère', marginLeft, 33)

  autoTable(doc, {
    startY: 37,
    head: [['Critère national', 'Note nationale', 'Indice (0–100)', 'Écart', 'Lecture']],
    body: national.map((r) => [
      r.code,
      r.noteNationale ?? '—',
      r.id ?? '—',
      r.ecart ?? '—',
      r.interpretation ? INTERP_FR[r.interpretation] : '—',
    ]),
    margin: { left: marginLeft, right: marginRight },
    styles: { ...pdfTableStyles.styles, fontSize: pdfFontSize.caption, cellPadding: 2 },
    headStyles: { ...pdfTableStyles.headStyles },
    bodyStyles: { ...pdfTableStyles.bodyStyles },
    alternateRowStyles: { ...pdfTableStyles.alternateRowStyles },
  })

  // ── Section 2 : comparaison par province (PAYSAGE, ~13 colonnes) ──
  doc.addPage('a4', 'landscape')
  const lPageWidth = pdfLayout.pageHeight // 297 en paysage
  doc.setTextColor(pdfColors.primary)
  doc.setFontSize(pdfFontSize.h2)
  doc.setFont(pdfFonts.headline, 'bold')
  doc.text('Comparaison par province', marginLeft, 18)

  const nbCols = 2 + dimensionCodes.length
  const groupes = grouperAsnParProvince(faritany)
  const body: Array<Array<string | number | { content: string; colSpan: number; styles: Record<string, unknown> }>> = []
  for (const g of groupes) {
    body.push([
      {
        content: `${g.nom} — moyenne ${g.moyenne}`,
        colSpan: nbCols,
        styles: { fillColor: pdfColors.surfaceHigh, textColor: pdfColors.primary, fontStyle: 'bold' },
      },
    ])
    for (const l of g.lignes) {
      body.push([
        l.nom,
        l.scoreGlobal,
        ...dimensionCodes.map((c) => l.scoreParDimension[c] ?? 0),
      ])
    }
  }

  autoTable(doc, {
    startY: 22,
    head: [[niveauLabel, 'Indice', ...dimensionCodes]],
    body,
    margin: { left: marginLeft, right: marginRight },
    tableWidth: lPageWidth - marginLeft - marginRight,
    styles: { ...pdfTableStyles.styles, fontSize: pdfFontSize.label, cellPadding: 1.5, halign: 'center' },
    headStyles: { ...pdfTableStyles.headStyles, halign: 'center' },
    bodyStyles: { ...pdfTableStyles.bodyStyles, fontSize: pdfFontSize.label },
    columnStyles: { 0: { halign: 'left' } },
  })

  // (finalY conservé pour d'éventuelles sections futures)
  void finalY(doc, 22)

  return doc
}
