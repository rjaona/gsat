# Audit RLS — Indice de Déploiement (L4)

**2026-08-05 · branche `feat/indice-deploiement`.**
Méthode : technique Lot 1 — seed d'une éval nationale v3_0 puis lectures sous vrais
JWT (`set local role authenticated` + `request.jwt.claims`), en transaction rollback,
sur Supabase local. Script : `docs/superpowers/verif/indice-rls.sql`.

## Verdict : aucune nouvelle policy nécessaire — la feature est sûre

Le modèle RLS du Lot 1 (`evals_select` / `scores_select`) autorise déjà exactement ce
que la page requiert, et **préserve l'isolation** sur la surface de données nouvelle
(l'éval nationale, que le Faritany ne doit pas voir).

| Check (sous JWT) | Attendu | Obtenu | Verdict |
|---|---|---|---|
| `responsable_osn` @ TEM lit les scores de l'éval **nationale** | > 0 | **2** | ✅ |
| `responsable_osn` @ TEM lit les scores **far descendants** (33 Faritany) | > 0 | **781** | ✅ |
| `responsable_region` @ TEM lit les scores far descendants (sous-arbre) | > 0 | **781** | ✅ |
| `responsable_asn` @ Faritany lit l'éval **nationale** (parent) | **0** | **0** | ✅ isolation |
| `responsable_asn` @ Faritany lit **ses propres** scores far | > 0 | **781** | ✅ |
| `responsable_asn` @ Faritany lit les scores far d'**autres** orgs | 0 | **0** | ✅ isolation |

## Pourquoi ça marche (lecture des policies)

- `scores_select` (USING) rend une ligne lisible si son éval l'est via `evals_select`,
  qui autorise : `admin_global` ; `org_id = jwt.org_id` (sa propre org) ;
  `responsable_osn`/`responsable_region` dont `jwt.org_id` est le **parent** de l'org
  évaluée (ou l'org elle-même).
- **OSN @ TEM** : lit l'éval nationale (`org_id = TEM = jwt.org_id`) **et** les 33
  Faritany (`o.parent_id = TEM`). ✔
- **ASN @ Faritany** : ne lit que sa propre org ; l'éval nationale (`org_id = TEM`, son
  **parent**) n'est couverte par aucune clause `asn` → **bloquée**. ✔

## Confirme la décision RLS du spec (§4)

Lecture des `evaluation_scores` nationaux **en clair** sous le JWT — légitime car la page
est réservée à `admin_global | responsable_osn | responsable_region` (RoleGuard +
Sidebar, rôles identiques, vérifiés en revue Task 4). **Pas de fonction SECURITY
DEFINER.** Le `responsable_asn` n'a ni la page ni les données.

## Note de seed (local)
Le seed de test place toutes les évals far sous une seule org (`Analamanga - Afovoany`),
d'où `asn_sibling = 0` faute de fratrie far seedée ; l'isolation fratrie reste néanmoins
prouvée séparément au Lot 1 (`AUDIT_LOT1.md`). Le check décisif ici — asn **bloqué sur
l'éval nationale** — ne dépend pas de ce détail et passe.

## Prérequis go-live (rappel)
En prod, la page ne renverra des **écarts** que si l'OSN possède une auto-évaluation
**v3_0** (statut `validee` préférée) rattachée à une campagne v3_0. Sans elle, l'ID
s'affiche seul (écarts « — »), ce qui est le comportement voulu (garde-fou #4).
