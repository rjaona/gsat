#!/usr/bin/env bash
# À exécuter SUR le VPS. Args: <EMAIL> <PASSWORD> <EVAL_ID> <CODES_CSV>
# CODES_CSV = "F101:3,F103:NA,F401:ABSENT,..."  (NA => note null ; ABSENT => rien écrit)
# ANON dérivé du bundle frontend ; updated_by = uid du token (auth.uid()).
set -euo pipefail
EMAIL="$1"; PW="$2"; EVAL="$3"; CODES="$4"
BASE="http://127.0.0.1:54331"
ANON=$(grep -rhoE 'eyJhbGciOiJIUzI1Ni[A-Za-z0-9_.-]+' /var/www/gsat-frontend/assets/*.js | head -1)
[ -n "$ANON" ] || { echo "ANON introuvable"; exit 2; }
RESP=$(curl -s "$BASE/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H "Content-Type: application/json" \
       -d "{\"email\":\"$EMAIL\",\"password\":\"$PW\"}")
JWT=$(echo "$RESP" | jq -r .access_token); UID=$(echo "$RESP" | jq -r .user.id)
{ [ "$JWT" != "null" ] && [ -n "$JWT" ] && [ "$UID" != "null" ]; } || { echo "LOGIN FAIL $EMAIL : $(echo "$RESP"|jq -r .error_description // .msg // .)"; exit 1; }
echo "login OK $EMAIL (uid=$UID)"
IFS=',' read -ra PAIRS <<< "$CODES"
ok=0; skip=0; fail=0
for p in "${PAIRS[@]}"; do
  code="${p%%:*}"; val="${p##*:}"
  [ "$val" = "ABSENT" ] && { echo "  $code -> skip(absent)"; skip=$((skip+1)); continue; }
  if [ "$val" = "NA" ]; then note='null'; else note="$val"; fi
  http=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rest/v1/evaluation_scores" \
     -H "apikey: $ANON" -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
     -H "Prefer: resolution=merge-duplicates" \
     -d "{\"eval_id\":\"$EVAL\",\"critere_code\":\"$code\",\"note\":$note,\"updated_by\":\"$UID\"}")
  echo "  $code=$val -> $http"
  case "$http" in 20*) ok=$((ok+1));; *) fail=$((fail+1));; esac
done
echo "== $EMAIL : ok=$ok skip=$skip fail=$fail =="
