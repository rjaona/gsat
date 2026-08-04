import type { Organisation } from '@/types';

/**
 * Provinces TEM : le préfixe de `organisations.code` (partie avant le premier
 * '-') porte la province — ce n'est PAS un niveau d'organisation (cf. CLAUDE.md).
 * Les libellés sont des noms propres, identiques fr/en ; l'ordre fixe l'affichage.
 */
export const PROVINCES: ReadonlyArray<{ prefixe: string; nom: string }> = [
  { prefixe: 'ANT', nom: 'Antananarivo' },
  { prefixe: 'TOA', nom: 'Toamasina' },
  { prefixe: 'MAH', nom: 'Mahajanga' },
  { prefixe: 'FIA', nom: 'Fianarantsoa' },
  { prefixe: 'TOL', nom: 'Toliara' },
  { prefixe: 'DIA', nom: 'Antsiranana' },
  { prefixe: 'DSP', nom: 'Diaspora' },
];

export interface GroupeProvince {
  prefixe: string;
  nom: string;
  orgs: Organisation[];
}

/** Préfixe province d'un code organisation ('ANT-01' → 'ANT'). Vide → '??'. */
export function prefixeProvince(code: string | undefined): string {
  return (code ?? '').split('-')[0] || '??';
}

/**
 * Regroupe des organisations par province (préfixe de code). Les provinces
 * connues sont ordonnées selon PROVINCES ; les préfixes inconnus finissent en
 * queue sous leur libellé brut. Les Faritany d'un groupe sont triés par code.
 */
export function grouperParProvince(orgs: Organisation[]): GroupeProvince[] {
  const parPrefixe = new Map<string, Organisation[]>();
  for (const o of orgs) {
    const prefixe = prefixeProvince(o.code);
    const list = parPrefixe.get(prefixe) ?? [];
    list.push(o);
    parPrefixe.set(prefixe, list);
  }

  const rang = new Map(PROVINCES.map((p, i) => [p.prefixe, i]));
  return [...parPrefixe.entries()]
    .map(([prefixe, list]) => ({
      prefixe,
      nom: PROVINCES.find(p => p.prefixe === prefixe)?.nom ?? prefixe,
      orgs: list.slice().sort((a, b) => (a.code ?? '').localeCompare(b.code ?? '')),
    }))
    .sort((a, b) => (rang.get(a.prefixe) ?? 99) - (rang.get(b.prefixe) ?? 99));
}
