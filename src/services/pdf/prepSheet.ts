/**
 * prepSheet.ts — Fiche de préparation PAPIER pour le comité Faritany.
 *
 * Mesure 1 des « 5 mesures du 100 % en ligne » : aucun mode offline, mais le
 * comité travaille sur papier là où la discussion a lieu (une case par note,
 * une ligne de commentaire), puis une personne saisit depuis un point connecté.
 * En mode socle, seuls les 42 critères du socle figurent.
 */

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { pdfColors, pdfFonts, pdfFontSize, pdfLayout, pdfTableStyles } from './pdfTheme'
import type { Referentiel, CampagneMode } from '@/types'

/** Critères comptant pour le mode (socle → socle uniquement), groupés par dimension. */
export function critParDimension(ref: Referentiel, mode: CampagneMode) {
  return ref.dimensions
    .map(d => ({
      dim: d,
      criteres: d.criteres.filter(c => c.actif && (mode !== 'socle' || c.socle)),
    }))
    .filter(g => g.criteres.length > 0)
}

/**
 * Génère la fiche de préparation. Retourne le doc jsPDF (l'appelant fait
 * `.save(...)`), comme les autres générateurs PDF du projet.
 */
export function generatePrepSheet(
  ref: Referentiel,
  mode: CampagneMode,
  options: { orgName?: string | undefined; date?: string | undefined } = {},
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const { marginLeft, marginRight, pageWidth } = pdfLayout
  const contentRight = pageWidth - marginRight
  const date = options.date ?? new Date().toLocaleDateString('fr-FR')

  // ── En-tête ──
  doc.setFillColor(pdfColors.primary)
  doc.rect(marginLeft, 10, 12, 12, 'F')
  doc.setTextColor(pdfColors.white)
  doc.setFontSize(pdfFontSize.caption)
  doc.setFont(pdfFonts.headline, 'bold')
  doc.text('WOSM', marginLeft + 1.5, 17)

  doc.setTextColor(pdfColors.primary)
  doc.setFontSize(pdfFontSize.h1)
  doc.text('Fiche de préparation — GSAT-Faritany', marginLeft + 16, 15)
  doc.setTextColor(pdfColors.onSurfaceVariant)
  doc.setFontSize(pdfFontSize.caption)
  doc.setFont(pdfFonts.body, 'normal')
  const sousTitre = mode === 'socle' ? 'Socle (critères obligatoires)' : 'Référentiel complet'
  doc.text(`${sousTitre}${options.orgName ? ' · ' + options.orgName : ''} · ${date}`, marginLeft + 16, 21)

  doc.setDrawColor(pdfColors.primary)
  doc.setLineWidth(0.5)
  doc.line(marginLeft, 25, contentRight, 25)

  doc.setFontSize(pdfFontSize.micro)
  doc.setTextColor(pdfColors.outline)
  doc.text(
    'Notez chaque critère (0 = non conforme, 3 = conforme total, N/A = non applicable), puis saisissez en ligne.',
    marginLeft, 30,
  )

  // ── Tables par dimension ──
  let y = 35
  for (const { dim, criteres } of critParDimension(ref, mode)) {
    autoTable(doc, {
      startY: y,
      head: [[`${dim.code} — ${dim.nom.fr}`, 'Note', 'Commentaire']],
      body: criteres.map(c => [`${c.code}  ${c.libelle.fr}`, '', '']),
      margin: { left: marginLeft, right: marginRight },
      styles: { ...pdfTableStyles.styles, fontSize: pdfFontSize.caption, cellPadding: 2, minCellHeight: 9 },
      headStyles: { ...pdfTableStyles.headStyles },
      bodyStyles: { ...pdfTableStyles.bodyStyles, lineColor: pdfColors.outline, lineWidth: 0.15 },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 16, halign: 'center' },   // case vide = à noter à la main
        2: { cellWidth: 55 },                       // ligne de commentaire
      },
    })
    y = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 20
    y += 4
  }

  return doc
}
