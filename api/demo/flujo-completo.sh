#!/usr/bin/env bash
# =====================================================================
# Demostracion del prototipo (Evaluacion 3) para sacar las capturas.
#
# Requisitos: la API corriendo (npm run start:dev) con las bases de
# docker-compose y los datos de prueba. En Windows, correr en Git Bash.
#
#   bash demo/flujo-completo.sh            # todo
#   bash demo/flujo-completo.sh flujo      # solo el flujo normal
#   bash demo/flujo-completo.sh ataques    # solo los ataques bloqueados
#
# Cada paso muestra el codigo HTTP y la respuesta, y entre corchetes el
# requerimiento funcional (RF) del informe que demuestra. Las respuestas reales
# son las que van al informe: no editar los resultados.
# =====================================================================
set -u
API="${API:-http://localhost:3000/api}"
CLAVE='Clave.Prueba.2026'
TRAZADO='00000000-0000-4000-8000-000000000100'
SENTIDO_IDA='00000000-0000-4000-8000-000000000101'
JORNADA='00000000-0000-4000-8000-000000000302'
ABORDAJE_AJENO='00000000-0000-4000-8000-000000000401'
QUE="${1:-todo}"

# Muestra el paso, el codigo HTTP y el cuerpo formateado.
paso() {
  local titulo="$1"; shift
  echo
  echo "------------------------------------------------------------------"
  echo "  $titulo"
  echo "------------------------------------------------------------------"
  local salida
  salida=$(curl -s -w '\n%{http_code}' "$@")
  local codigo="${salida##*$'\n'}"
  local cuerpo="${salida%$'\n'*}"
  echo "HTTP $codigo"
  [ -n "$cuerpo" ] && echo "$cuerpo" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.stringify(JSON.parse(s),null,2))}catch{console.log(s)}})'
  ULTIMO_CUERPO="$cuerpo"
}

campo() { echo "$ULTIMO_CUERPO" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const o=JSON.parse(s);console.log(o$1 ?? '')})"; }

json() { curl -s -X POST "$API/autenticacion/inicio-sesion" -H 'Content-Type: application/json' -d "$1"; }
token_de() {
  json "{\"correo_electronico\":\"$1\",\"contrasena\":\"$CLAVE\"}" |
    node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).token_acceso))'
}

T_CONDUCTOR=$(token_de conductor1@colectivos.ejemplo.cl)
T_PASAJERO=$(token_de pasajero2@colectivos.ejemplo.cl)
T_REPRESENTANTE=$(token_de representante@colectivos.ejemplo.cl)
H='Content-Type: application/json'

if [ "$QUE" = "todo" ] || [ "$QUE" = "flujo" ]; then
  echo; echo "=================== FLUJO NORMAL ==================="
  T_CONDUCTOR3=$(token_de conductor3@colectivos.ejemplo.cl)
  VEHICULO_LIBRE='00000000-0000-4000-8000-000000000203'
  SENTIDO_VUELTA='00000000-0000-4000-8000-000000000102'

  # -i muestra las cabeceras: se ve la cookie con HttpOnly y SameSite=Strict.
  paso "1. [RF-01] Inicio de sesion del pasajero (el token de refresco va solo en la cookie)" \
    -i -X POST "$API/autenticacion/inicio-sesion" -H "$H" \
    -d "{\"correo_electronico\":\"pasajero2@colectivos.ejemplo.cl\",\"contrasena\":\"$CLAVE\"}"

  paso "2. [RF-03] Pasajero: trazados activos y sus sentidos" \
    "$API/trazados" -H "Authorization: Bearer $T_PASAJERO"

  paso "3. [RF-02] Pasajero: acepta el uso de su ubicacion" \
    -X POST "$API/usuarios/yo/consentimientos/geolocalizacion" -H "Authorization: Bearer $T_PASAJERO"

  paso "4. [RF-04] Conductor 3: autos libres de su trazado" \
    "$API/flota/vehiculos-disponibles" -H "Authorization: Bearer $T_CONDUCTOR3"

  paso "5. [RF-04] Conductor 3: abre su jornada en el ZZ9903, sentido ida" \
    -X POST "$API/jornadas" -H "Authorization: Bearer $T_CONDUCTOR3" -H "$H" \
    -d "{\"vehiculo_id\":\"$VEHICULO_LIBRE\",\"sentido_id\":\"$SENTIDO_IDA\"}"

  paso "6. [RF-06] Conductor 3: llega al terminal y cambia a sentido vuelta" \
    -X PATCH "$API/jornadas/actual/sentido" -H "Authorization: Bearer $T_CONDUCTOR3" -H "$H" \
    -d "{\"sentido_id\":\"$SENTIDO_VUELTA\"}"

  paso "7. [RF-08] Conductor 3: cierra su jornada" \
    -X POST "$API/jornadas/actual/cierre" -H "Authorization: Bearer $T_CONDUCTOR3"

  paso "8. Conductor 1: ve su jornada abierta" \
    "$API/jornadas/actual" -H "Authorization: Bearer $T_CONDUCTOR"

  paso "9. [RF-05] Conductor 1: envia su posicion (punto 2 del recorrido)" \
    -X POST "$API/tiempo-real/posiciones" -H "Authorization: Bearer $T_CONDUCTOR" -H "$H" \
    -d '{"latitud":-33.6062,"longitud":-70.5764}'

  # Segunda posicion en el mismo punto: el servidor calcula 0 km/h (auto detenido).
  sleep 1.2
  curl -s -o /dev/null -X POST "$API/tiempo-real/posiciones" -H "Authorization: Bearer $T_CONDUCTOR" -H "$H" -d '{"latitud":-33.6062,"longitud":-70.5764}'
  paso "10. [RF-06] Conductor 1: detenido, ajusta los asientos libres a 2" \
    -X PATCH "$API/jornadas/actual/asientos" -H "Authorization: Bearer $T_CONDUCTOR" -H "$H" \
    -d '{"asientos_disponibles":2}'

  paso "11. [RF-09] Pasajero: ve los colectivos que vienen y en cuantos minutos llegan" \
    "$API/tiempo-real/colectivos?sentido_id=$SENTIDO_IDA&latitud=-33.5975&longitud=-70.5781" \
    -H "Authorization: Bearer $T_PASAJERO"

  paso "12. [RF-10] Pasajero: avisa 'estoy esperando' (2 personas)" \
    -X POST "$API/avisos-espera" -H "Authorization: Bearer $T_PASAJERO" -H "$H" \
    -d "{\"sentido_id\":\"$SENTIDO_IDA\",\"latitud\":-33.5975,\"longitud\":-70.5781,\"personas\":2}"

  paso "13. [RF-07] Conductor 1: ve cuanta gente espera mas adelante (sin saber quien)" \
    "$API/avisos-espera/adelante" -H "Authorization: Bearer $T_CONDUCTOR"

  paso "14. [RF-11] Pasajero: marca 'me subi' junto al colectivo" \
    -X POST "$API/abordajes" -H "Authorization: Bearer $T_PASAJERO" -H "$H" \
    -d "{\"jornada_id\":\"$JORNADA\",\"latitud\":-33.6061,\"longitud\":-70.5764}"
  ABORDAJE=$(campo '.id')

  paso "15. [RF-11] Pasajero: sus ultimos viajes" \
    "$API/abordajes/mios" -H "Authorization: Bearer $T_PASAJERO"

  if [ -n "$ABORDAJE" ]; then
    paso "16. [RF-12] Pasajero: califica el viaje con 5 estrellas" \
      -X POST "$API/abordajes/$ABORDAJE/calificacion" -H "Authorization: Bearer $T_PASAJERO" -H "$H" \
      -d '{"estrellas":5}'
  fi

  paso "17. [RF-13] Representante: demanda de hoy por tramo y hora" \
    "$API/estadisticas/trazados/$TRAZADO/demanda" -H "Authorization: Bearer $T_REPRESENTANTE"

  paso "18. [RF-14] Representante: resumen por conductor (sin datos de pasajeros)" \
    "$API/estadisticas/trazados/$TRAZADO/conductores" -H "Authorization: Bearer $T_REPRESENTANTE"
fi

if [ "$QUE" = "todo" ] || [ "$QUE" = "ataques" ]; then
  echo; echo "=================== ATAQUES BLOQUEADOS ==================="

  paso "A1. Sin sesion -> 401 (acceso ilicito, Ley 21.459)" \
    "$API/jornadas/actual"

  paso "A2. Token alterado -> 401" \
    "$API/jornadas/actual" -H "Authorization: Bearer ${T_CONDUCTOR%?????}AAAAA"

  paso "A3. Pasajero intenta abrir una jornada -> 403 (control de acceso, OWASP A01)" \
    -X POST "$API/jornadas" -H "Authorization: Bearer $T_PASAJERO" -H "$H" \
    -d "{\"vehiculo_id\":\"00000000-0000-4000-8000-000000000203\",\"sentido_id\":\"$SENTIDO_IDA\"}"

  paso "A4. Registro con 'rol: administrador' -> 400 (campo no permitido)" \
    -X POST "$API/autenticacion/registro" -H "$H" \
    -d '{"nombre_completo":"Atacante","correo_electronico":"atacante@ejemplo.cl","contrasena":"caballo-pila-grapa-azul","acepta_terminos":true,"rol":"administrador"}'

  paso "A5. Inyeccion SQL en un id -> 400 (OWASP A05)" \
    -X POST "$API/abordajes/1'%20OR%20'1'='1/calificacion" -H "Authorization: Bearer $T_PASAJERO" -H "$H" \
    -d '{"estrellas":1}'

  paso "A6. Calificar el viaje de otra persona -> 404 (no confirma que exista)" \
    -X POST "$API/abordajes/$ABORDAJE_AJENO/calificacion" -H "Authorization: Bearer $T_PASAJERO" -H "$H" \
    -d '{"estrellas":1}'

  paso "A7. Representante pide un trazado ajeno -> 404 y queda en la auditoria" \
    "$API/estadisticas/trazados/00000000-0000-4000-8000-000000000999/demanda" \
    -H "Authorization: Bearer $T_REPRESENTANTE"

  paso "A8. 'Me subi' desde lejos (calificacion falsa) -> 422 (OWASP A06)" \
    -X POST "$API/abordajes" -H "Authorization: Bearer $T_PASAJERO" -H "$H" \
    -d "{\"jornada_id\":\"$JORNADA\",\"latitud\":-33.5842,\"longitud\":-70.5807}"

  paso "A9. Posicion GPS fuera del recorrido -> 422" \
    -X POST "$API/tiempo-real/posiciones" -H "Authorization: Bearer $T_CONDUCTOR" -H "$H" \
    -d '{"latitud":-33.6018,"longitud":-70.5805}'

  # El auto "avanza" 15 m en ~1 s (unos 50 km/h) y luego intenta cambiar asientos.
  curl -s -o /dev/null -X POST "$API/tiempo-real/posiciones" -H "Authorization: Bearer $T_CONDUCTOR" -H "$H" -d '{"latitud":-33.6062,"longitud":-70.5764}'
  sleep 1.2
  curl -s -o /dev/null -X POST "$API/tiempo-real/posiciones" -H "Authorization: Bearer $T_CONDUCTOR" -H "$H" -d '{"latitud":-33.60607,"longitud":-70.5764,"velocidad_kmh":0}'
  paso "A10. Cambiar asientos en movimiento (aunque diga 0 km/h) -> 422 (Ley 21.377)" \
    -X PATCH "$API/jornadas/actual/asientos" -H "Authorization: Bearer $T_CONDUCTOR" -H "$H" \
    -d '{"asientos_disponibles":1}'

  echo; echo "A11. Fuerza bruta: 6 intentos con contrasena incorrecta (el 6.o debe dar 429)"
  for i in 1 2 3 4 5 6; do
    codigo=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/autenticacion/inicio-sesion" -H "$H" \
      -d '{"correo_electronico":"fuerza-bruta@ejemplo.cl","contrasena":"probando-una-clave"}')
    echo "  intento $i -> HTTP $codigo"
  done
fi
echo
