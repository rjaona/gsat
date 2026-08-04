#!/usr/bin/env bash
# =============================================================================
# GSAT-Faritany — mise en place base de données, en une seule commande.
#   ./setup_base_gsat_faritany.sh "postgresql://user:pass@host:5432/postgres"
#
# S'arrête à la première erreur et vérifie chaque étape. Rejouable.
# =============================================================================
set -euo pipefail
DB="${1:?Usage: $0 <URL_POSTGRES>}"
cd "$(dirname "$0")/.."   # racine gsat-v2

ok()  { printf '  \033[32m✓\033[0m %s\n' "$1"; }
die() { printf '  \033[31m✗\033[0m %s\n' "$1"; exit 1; }

echo "1/5  Migration — partie 0 (ALTER TYPE, transaction séparée obligatoire)"
awk '/^-- PARTIE 1/{exit} {print}' supabase/migrations/20260804_faritany.sql \
  | psql "$DB" -v ON_ERROR_STOP=1 -q
ok "valeurs d'ENUM ajoutées"

echo "2/5  Migration — parties 1 à 9"
awk 'f{print} /^-- PARTIE 1/{f=1; print}' supabase/migrations/20260804_faritany.sql \
  | psql "$DB" -v ON_ERROR_STOP=1 -q
psql "$DB" -tAc "SELECT 1 FROM information_schema.columns
                 WHERE table_name='criteres' AND column_name='socle'" | grep -q 1 \
  || die "colonne criteres.socle absente — la migration n'a pas abouti"
ok "schéma migré"

echo "3/5  Types TypeScript"
npx supabase gen types typescript --db-url "$DB" > src/types/supabase.generated.ts
npx tsc --noEmit || die "tsc en échec après régénération des types"
ok "types régénérés, tsc propre"

echo "4/5  Seed du référentiel far_v1_0"
SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:-}" npx tsx scripts/seed-referentiel-faritany.ts
read -r T S E < <(psql "$DB" -tAF' ' -c "
  SELECT count(*), count(*) FILTER (WHERE socle), count(*) FILTER (WHERE essentiel)
  FROM criteres c JOIN dimensions d ON d.id=c.dimension_id
  JOIN referentiel_versions r ON r.id=d.ref_id WHERE r.version='far_v1_0'")
[ "$T" = 76 ] && [ "$S" = 42 ] && [ "$E" = 17 ] \
  || die "référentiel incohérent : $T critères / $S socle / $E essentiels (attendu 76/42/17)"
ok "référentiel : 76 critères, 42 socle, 17 essentiels"

echo "5/5  Seed des 33 Faritany"
psql "$DB" -v ON_ERROR_STOP=1 -q -f scripts/seed_33_faritany.sql
N=$(psql "$DB" -tAc "SELECT count(*) FROM organisations
                     WHERE type='ASN' AND parent_id=(SELECT id FROM organisations WHERE code='TEM')")
[ "$N" = 33 ] || die "$N Faritany en base au lieu de 33"
ok "33 Faritany"
psql "$DB" -c "SELECT split_part(code,'-',1) AS province, count(*)
               FROM organisations WHERE type='ASN'
                 AND parent_id=(SELECT id FROM organisations WHERE code='TEM')
               GROUP BY 1 ORDER BY 1"

echo
echo "Base prête. Reste : les 33 comptes responsable_asn via la Edge Function"
echo "manage-user — la boucle est en commentaire à la fin de scripts/seed_33_faritany.sql."
