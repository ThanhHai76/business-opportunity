#!/usr/bin/env bash
# Backs up the PostgreSQL database (accounts, orders, paid reports, Living Score data) to a compressed file.
#
#   bash deploy/backup.sh                    one backup now, into ./backups, older than 14 days removed
#   KEEP_DAYS=30 BACKUP_DIR=/mnt/disk bash deploy/backup.sh
#
# Every night, with cron (crontab -e):
#   30 2 * * * cd /home/deploy/hanoi-century-vista && bash deploy/backup.sh >> backups/backup.log 2>&1
#
# A backup on the same server is lost with the server: copy the files somewhere else too (see DEPLOY.md).
set -euo pipefail

cd "$(dirname "$0")/.."
KEEP_DAYS="${KEEP_DAYS:-14}"
DEST="${BACKUP_DIR:-$PWD/backups}"
COMPOSE=(docker compose -f docker-compose.prod.yml)

mkdir -p "$DEST"
file="$DEST/living_score-$(date +%Y%m%d-%H%M%S).sql.gz"

# pipefail: if pg_dump fails the whole command fails, and the half-written file is thrown away.
if ! "${COMPOSE[@]}" exec -T db pg_dump -U living --no-owner living_score | gzip > "$file.partial"; then
  rm -f "$file.partial"
  echo "Backup FAILED: pg_dump did not finish (is the db container running?)" >&2
  exit 1
fi
mv "$file.partial" "$file"

# Old backups.
find "$DEST" -name 'living_score-*.sql.gz' -mtime +"$KEEP_DAYS" -delete

echo "$(date '+%F %T') backup written: $file ($(du -h "$file" | cut -f1))"
