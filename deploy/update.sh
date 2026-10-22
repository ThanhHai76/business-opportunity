#!/usr/bin/env bash
# Puts the latest code from GitHub on the server:  bash deploy/update.sh
# It takes a backup first, then rebuilds and restarts what changed (the database and its data stay).
set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE=(docker compose -f docker-compose.prod.yml)

echo "==> Backup before the update"
bash deploy/backup.sh || echo "   (no backup: continuing, the stack may not be running yet)"

echo "==> Latest code"
git pull --ff-only

echo "==> Build and restart"
"${COMPOSE[@]}" build
"${COMPOSE[@]}" up -d --remove-orphans

echo "==> Clean old images"
docker image prune -f >/dev/null

echo "==> Status"
"${COMPOSE[@]}" ps
echo
echo "Check the site, and the logs if something looks wrong:  docker compose -f docker-compose.prod.yml logs --tail=100 backend"
