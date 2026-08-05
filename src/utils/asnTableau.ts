import { prefixeProvince, PROVINCES } from './perimetreProvinces';

/** Ligne ASN (Faritany) du tableau national. */
export interface LigneAsn {
  asnId: string;
  nom: string;
  scoreGlobal: number;
  scoreParDimension: Record<string, number>;
  code?: string | undefined;
}

export interface GroupeAsn<T extends LigneAsn = LigneAsn> {
  prefixe: string;
  nom: string;
  lignes: T[];
  moyenne: number;
}

/**
 * Seuil du quartile bas (25e centile, interpolation basse) des scores globaux.
 * Les lignes de score ≤ seuil sont « à surveiller » — mise en avant plutôt
 * qu'affichage exhaustif de 33 lignes. Retourne -Infinity si liste vide.
 */
export function seuilQuartileBas(scores: number[]): number {
  if (scores.length === 0) return -Infinity;
  const tri = [...scores].sort((a, b) => a - b);
  const idx = Math.floor((tri.length - 1) * 0.25);
  return tri[idx] ?? -Infinity;
}

/**
 * Groupe les lignes par province (préfixe de `code`), chaque groupe trié par
 * `triCle` (score global si null, sinon une dimension), sens `asc`. Provinces
 * ordonnées selon PROVINCES ; préfixes inconnus en queue. `moyenne` = moyenne
 * arrondie des scores globaux du groupe.
 */
export function grouperAsnParProvince<T extends LigneAsn>(
  lignes: T[],
  triCle: string | null = null,
  asc = false,
): GroupeAsn<T>[] {
  const valeur = (l: T) => (triCle == null ? l.scoreGlobal : (l.scoreParDimension[triCle] ?? 0));

  const parPrefixe = new Map<string, T[]>();
  for (const l of lignes) {
    const p = prefixeProvince(l.code);
    (parPrefixe.get(p) ?? parPrefixe.set(p, []).get(p)!).push(l);
  }

  const rang = new Map(PROVINCES.map((p, i) => [p.prefixe, i]));
  return [...parPrefixe.entries()]
    .map(([prefixe, list]): GroupeAsn<T> => {
      const lignesTriees = [...list].sort((a, b) => (asc ? valeur(a) - valeur(b) : valeur(b) - valeur(a)));
      const moyenne = list.length
        ? Math.round(list.reduce((s, l) => s + l.scoreGlobal, 0) / list.length)
        : 0;
      return {
        prefixe,
        nom: PROVINCES.find(p => p.prefixe === prefixe)?.nom ?? prefixe,
        lignes: lignesTriees,
        moyenne,
      };
    })
    .sort((a, b) => (rang.get(a.prefixe) ?? 99) - (rang.get(b.prefixe) ?? 99));
}
