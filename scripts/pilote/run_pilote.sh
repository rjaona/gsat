#!/usr/bin/env bash
# Driver VPS : écrit les scores des 3 Faritany + l'auto-éval nationale v3_0.
# Mots de passe lus depuis /root/gsat_faritany_accounts.md (jamais passés en clair ailleurs).
set -euo pipefail
cd "$(dirname "$0")"
M=matrice_scores.json
ACC=/root/gsat_faritany_accounts.md
pw(){ grep -F "$1" "$ACC" | head -1 | cut -d'|' -f3; }
csv(){ jq -r --arg c "$1" '[.faritany[] | .code+":"+((.[$c])|tostring)] | join(",")' "$M"; }
natcsv(){ jq -r '[.national[] | .v3Code+":"+((.note)|tostring)] | join(",")' "$M"; }

echo "### ANT-01 (fort)";  bash ecrire_scores.sh "ant.01@tem.mg" "$(pw ant.01@tem.mg)" "d5000000-0000-4000-8000-0000000e0001" "$(csv F1)"
echo "### ANT-02 (moyen)"; bash ecrire_scores.sh "ant.02@tem.mg" "$(pw ant.02@tem.mg)" "d5000000-0000-4000-8000-0000000e0002" "$(csv F2)"
echo "### ANT-03 (faible)";bash ecrire_scores.sh "ant.03@tem.mg" "$(pw ant.03@tem.mg)" "d5000000-0000-4000-8000-0000000e0003" "$(csv F3)"
echo "### NATIONAL v3_0 (admin)"; bash ecrire_scores.sh "admin@gsat.tily-digital.com" "$(pw admin@gsat.tily-digital.com)" "d3000000-0000-4000-8000-0000000e0001" "$(natcsv)"
