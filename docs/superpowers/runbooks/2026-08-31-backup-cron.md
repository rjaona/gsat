# Backup cron GSAT — Runbook d'installation

## Script `/root/gsat_backup.sh`

```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/root/gsat_backups"
DAILY_DIR="$BACKUP_DIR/daily"
MONTHLY_DIR="$BACKUP_DIR/monthly"
LOG="$BACKUP_DIR/backup.log"
CONTAINER="supabase_db_gsat"
DATE=$(date +%Y%m%d_%H%M%S)
DAY_OF_MONTH=$(date +%d)

mkdir -p "$DAILY_DIR" "$MONTHLY_DIR"

DUMP_FILE="$DAILY_DIR/gsat_${DATE}.dump"

echo -n "[$(date -Iseconds)] Backup... " >> "$LOG"

if docker exec "$CONTAINER" pg_dump -U postgres -Fc postgres > "$DUMP_FILE" 2>>"$LOG"; then
  chmod 0600 "$DUMP_FILE"
  SIZE=$(stat -c%s "$DUMP_FILE")
  if [ "$SIZE" -lt 1024 ]; then
    echo "FAILED (dump ${SIZE}B < 1KB)" >> "$LOG"
    exit 1
  fi
  echo "OK (${SIZE}B) -> $(basename "$DUMP_FILE")" >> "$LOG"

  # Copie mensuelle le 1er du mois
  if [ "$DAY_OF_MONTH" = "01" ]; then
    cp "$DUMP_FILE" "$MONTHLY_DIR/"
    echo "[$(date -Iseconds)] Monthly copy -> monthly/$(basename "$DUMP_FILE")" >> "$LOG"
  fi

  # Rotation : daily > 7 jours, monthly > 90 jours
  find "$DAILY_DIR" -name "gsat_*.dump" -mtime +7 -delete
  find "$MONTHLY_DIR" -name "gsat_*.dump" -mtime +90 -delete
else
  echo "FAILED (pg_dump exit $?)" >> "$LOG"
  rm -f "$DUMP_FILE"
  exit 1
fi
```

## Installation

```bash
# 1. Copier le script
cat > /root/gsat_backup.sh << 'SCRIPT'
# (coller le contenu ci-dessus)
SCRIPT
chmod +x /root/gsat_backup.sh

# 2. Créer les répertoires
mkdir -p /root/gsat_backups/{daily,monthly}

# 3. Ajouter au crontab root
(crontab -l 2>/dev/null; echo "0 3 * * * /root/gsat_backup.sh") | crontab -

# 4. Test manuel
/root/gsat_backup.sh && cat /root/gsat_backups/backup.log

# 5. Vérifier le dump
pg_restore --list /root/gsat_backups/daily/gsat_*.dump | head -20
```

## Restauration

```bash
# Restaurer un dump (ATTENTION : écrase la base)
docker exec -i supabase_db_gsat pg_restore -U postgres -d postgres --clean --if-exists < /root/gsat_backups/daily/gsat_YYYYMMDD_HHMMSS.dump
```
