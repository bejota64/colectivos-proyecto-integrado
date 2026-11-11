#!/bin/sh
# Prueba de rendimiento de PostgreSQL con pgbench (viene incluido en PostgreSQL).
# Simula 20 clientes simultaneos durante 30 segundos con la mezcla de consultas del MVP.
#
# Uso con Docker, desde la carpeta colectivos/:
#   docker compose exec -T postgres sh -c 'sh /scripts/rendimiento/ejecutar.sh'
# (dentro de comillas para que Git Bash no convierta la ruta /scripts en una ruta de Windows)
#
# Deja las tablas como estaban: borra la demanda de hoy que genera la prueba.
set -e
DIR="$(dirname "$0")"
BASE="${POSTGRES_DB:-colectivos}"
USUARIO="${POSTGRES_USER:-postgres}"
CLIENTES="${CLIENTES:-20}"
SEGUNDOS="${SEGUNDOS:-30}"

pgbench -n -U "$USUARIO" -c "$CLIENTES" -j 4 -T "$SEGUNDOS" -L 100 -r \
  -f "$DIR/01_inicio_sesion.sql@4" \
  -f "$DIR/02_aviso_demanda.sql@2" \
  -f "$DIR/03_punto_cercano.sql@2" \
  -f "$DIR/04_colectivos_en_servicio.sql@2" \
  "$BASE"

psql -q -U "$USUARIO" -d "$BASE" -c "DELETE FROM demanda_por_tramo WHERE fecha = current_date"
