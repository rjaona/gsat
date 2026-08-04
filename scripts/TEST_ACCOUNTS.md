# GSAT Digital v2 — Comptes de test

Ces comptes sont crees automatiquement par le script `npm run seed` dans l'emulateur Firebase.

## Comptes disponibles

| Email | Mot de passe | Role | Organisation | Type |
|-------|-------------|------|-------------|------|
| `admin@gsat-digital.org` | `Admin1234!` | admin_global | OMMS | OMMS |
| `region.africa@wosm.org` | `Region1234!` | responsable_region | Bureau Scout Africain | REGION |
| `responsable@tem.mg` | `Responsable1234!` | responsable_osn | TEM Madagascar | OSN |
| `responsable@senegal.scouts.sn` | `Senegal1234!` | responsable_osn | Scouts du Senegal | OSN |
| `antananarivo@tem.mg` | `Antana1234!` | utilisateur_asn | TEM Antananarivo | ASN |
| `fianarantsoa@tem.mg` | `Fiana1234!` | utilisateur_asn | TEM Fianarantsoa | ASN |
| `toamasina@tem.mg` | `Toama1234!` | utilisateur_asn | TEM Toamasina | ASN |
| `mahajanga@tem.mg` | `Mahaj1234!` | utilisateur_asn | TEM Mahajanga | ASN |
| `toliara@tem.mg` | `Tolia1234!` | utilisateur_asn | TEM Toliara | ASN |
| `antsiranana@tem.mg` | `Antsi1234!` | utilisateur_asn | TEM Antsiranana | ASN |
| `evaluateur@tem.mg` | `Eval1234!` | evaluateur | TEM Madagascar | OSN |
| `lecteur@tem.mg` | `Lecteur1234!` | lecteur | TEM Madagascar | OSN |

## Hierarchie des roles

```
admin_global          Acces total, gestion utilisateurs/referentiel
  responsable_region  Supervision des OSN d'une region OMMS
    responsable_osn   Gestion d'une Organisation Scoute Nationale
      utilisateur_asn Saisie evaluation pour une Association Scoute Nationale
      evaluateur      Evaluation externe (lecture + saisie accompagnee)
      lecteur         Consultation seule
```

## Donnees de test associees

- **Campagne** : "Evaluation Nationale TEM 2024-2025" (ouverte, perimetre 6 ASN TEM)
- **Evaluations** :
  - Antananarivo : validee, score 85%, scores detailles complets (100 criteres)
  - Fianarantsoa : soumise, score 72%, scores detailles complets
  - Toamasina : en_cours, score 61%, scores partiels (7/10 dimensions)
  - Mahajanga : en_cours, score 54%, scores par dimension seulement
  - Toliara : brouillon, pas de scores
  - Antsiranana : brouillon, pas de scores
- **Plan d'action** : Antananarivo, 4 actions (1 terminee, 1 en cours, 2 a faire), 3 suivis
- **DashboardStats** : 8 OSN (scores 29-82%) + 6 ASN TEM + 2 OSN sans stats (Egypte, Ghana)

## Isolation multi-tenant

- Un `utilisateur_asn` (ex: `antananarivo@tem.mg`) ne peut lire que les evaluations de son orgId (`tem-antananarivo`).
- Un `responsable_osn` (ex: `responsable@tem.mg`) voit les evaluations de toutes ses ASN via `parentOrgId`.
- Un `admin_global` voit tout.
- Le `responsable@senegal.scouts.sn` ne peut PAS lire les evaluations TEM.

## Scripts disponibles

```bash
npm run seed           # Charge toutes les donnees dans l'emulateur
npm run seed:reset     # Supprime tout puis relance le seed
npm run emulators      # Lance les emulateurs Firebase
npm run emulators:persist  # Emulateurs avec persistence sur disque
npm run dev:full       # Attend emulateurs + seed + lance Vite
```
