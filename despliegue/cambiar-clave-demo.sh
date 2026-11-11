#!/usr/bin/env bash
# Cambia la contrasena de las cuentas de demostracion (@colectivos.ejemplo.cl).
# La contrasena de los datos de prueba esta publicada en el repositorio, asi
# que en un servidor publico hay que cambiarla apenas se levanta.
# Uso:  bash cambiar-clave-demo.sh    (la pide sin mostrarla en pantalla)
set -euo pipefail
cd "$(dirname "$0")"

CLAVE="${CLAVE_DEMO:-}"
if [ -z "$CLAVE" ]; then
  read -rsp "Nueva contrasena para las cuentas de demostracion: " CLAVE
  echo
fi
# 15 caracteres: la politica de la API para representante y administrador.
if [ "${#CLAVE}" -lt 15 ]; then
  echo "La contrasena debe tener al menos 15 caracteres."
  exit 1
fi

# La contrasena viaja como variable de entorno y psql la usa como parametro
# (:'clave'), nunca pegada dentro del texto SQL.
docker compose exec -T -e CLAVE_DEMO="$CLAVE" postgres sh -c \
  'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d colectivos -v clave="$CLAVE_DEMO"' <<'SQL'
UPDATE usuarios
   SET contrasena_hash = crypt(:'clave', gen_salt('bf', 12)),
       actualizado_en = now()
 WHERE correo_electronico LIKE '%@colectivos.ejemplo.cl';
DELETE FROM tokens_refresco
 WHERE usuario_id IN (SELECT id FROM usuarios WHERE correo_electronico LIKE '%@colectivos.ejemplo.cl');
SQL

echo "Listo: las cuentas de demostracion usan la contrasena nueva y sus sesiones abiertas se cerraron."
