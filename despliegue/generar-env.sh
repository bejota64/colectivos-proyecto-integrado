#!/usr/bin/env bash
# Crea despliegue/.env con contrasenas y secreto aleatorios.
# Uso:  bash generar-env.sh               (pregunta el dominio)
#       bash generar-env.sh localhost     (pruebas automaticas)
# Nunca sobrescribe un .env existente: perderias el acceso a las bases.
set -euo pipefail
cd "$(dirname "$0")"

if [ -f .env ]; then
  echo "Ya existe despliegue/.env y no se modifica."
  exit 1
fi

DOMINIO="${1:-}"
if [ -z "$DOMINIO" ]; then
  read -rp "Dominio del servidor (por ejemplo colectivos-inacap.eastus.cloudapp.azure.com): " DOMINIO
fi
if ! [[ "$DOMINIO" =~ ^[a-z0-9.-]+$ ]]; then
  echo "Dominio invalido: usa solo minusculas, numeros, puntos y guiones."
  exit 1
fi

# Solo letras y numeros: un simbolo como @ o / romperia las URL de conexion.
umask 077
cat > .env <<FIN
DOMINIO=$DOMINIO
POSTGRES_USUARIO=colectivos_app
POSTGRES_CONTRASENA=$(openssl rand -hex 24)
MONGO_USUARIO=colectivos_admin
MONGO_CONTRASENA=$(openssl rand -hex 24)
SECRETO_JWT=$(openssl rand -hex 48)
FIN

echo "Listo: despliegue/.env creado. Solo tu usuario puede leerlo."
