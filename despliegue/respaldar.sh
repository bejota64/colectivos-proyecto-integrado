#!/usr/bin/env bash
# Respalda PostgreSQL y MongoDB en despliegue/respaldos/, con la fecha en el nombre.
# Uso:  bash respaldar.sh
# Restaurar: ver docs/despliegue-azure.md, seccion "Respaldos".
set -euo pipefail
cd "$(dirname "$0")"

FECHA=$(date +%Y-%m-%d_%H%M)
mkdir -p respaldos
chmod 700 respaldos

docker compose exec -T postgres sh -c \
  'pg_dump -U "$POSTGRES_USER" -d colectivos --format=custom' \
  > "respaldos/postgres_$FECHA.dump"

docker compose exec -T mongo sh -c \
  'mongodump --quiet --archive --gzip --db colectivos -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin' \
  > "respaldos/mongo_$FECHA.archive.gz"

echo "Respaldos creados:"
ls -lh "respaldos/postgres_$FECHA.dump" "respaldos/mongo_$FECHA.archive.gz"
