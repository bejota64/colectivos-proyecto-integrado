-- =====================================================================
-- Consultas de ejemplo: cada una responde a una pantalla del MVP.
-- Se usan los identificadores de los datos de prueba.
-- =====================================================================

\echo
\echo '1) Tarifas vigentes en este momento (pantalla del pasajero)'
SELECT nombre, monto
FROM tarifas
WHERE trazado_id = '00000000-0000-4000-8000-000000000100'
  AND vigente_desde <= now()
  AND (vigente_hasta IS NULL OR vigente_hasta > now())
  AND (
        hora_inicio IS NULL
        OR CASE
             WHEN hora_inicio < hora_fin THEN
                  (now() AT TIME ZONE 'America/Santiago')::time >= hora_inicio
              AND (now() AT TIME ZONE 'America/Santiago')::time <  hora_fin
             ELSE -- franja que cruza la medianoche
                  (now() AT TIME ZONE 'America/Santiago')::time >= hora_inicio
               OR (now() AT TIME ZONE 'America/Santiago')::time <  hora_fin
           END
      )
ORDER BY monto;

\echo
\echo '2) Colectivos en servicio, con asientos y nota del conductor (mapa)'
SELECT v.patente, v.marca || ' ' || v.modelo AS vehiculo,
       u.nombre_completo AS conductor,
       s.sentido, j.asientos_disponibles,
       round(avg(c.estrellas), 1) AS nota_promedio
FROM jornadas j
JOIN vehiculos v   ON v.id = j.vehiculo_id
JOIN usuarios u    ON u.id = j.conductor_id
LEFT JOIN sentidos s      ON s.id = j.sentido_actual_id
LEFT JOIN jornadas jh     ON jh.conductor_id = j.conductor_id
LEFT JOIN abordajes a     ON a.jornada_id = jh.id
LEFT JOIN calificaciones c ON c.abordaje_id = a.id
WHERE j.finalizada_en IS NULL
  AND v.trazado_id = '00000000-0000-4000-8000-000000000100'
GROUP BY v.patente, v.marca, v.modelo, u.nombre_completo, s.sentido, j.asientos_disponibles
ORDER BY v.patente;

\echo
\echo '3) Punto del recorrido mas cercano a un pasajero y su posicion en la ruta'
\echo '   (asi se valida que este cerca del trazado y se calcula su tramo)'
SELECT orden,
       distancia_acumulada_m,
       distancia_acumulada_m / 500 AS numero_tramo,
       round(distancia_metros(-33.5940, -70.5795, latitud, longitud)) AS metros_al_recorrido
FROM puntos_ruta
WHERE sentido_id = '00000000-0000-4000-8000-000000000101'
ORDER BY distancia_metros(-33.5940, -70.5795, latitud, longitud)
LIMIT 1;

\echo
\echo '4) Minutos estimados: colectivo en el punto 2, pasajero en el punto 5'
\echo '   (distancia sobre la ruta dividida por una velocidad promedio de 25 km/h)'
SELECT pasajero.distancia_acumulada_m - colectivo.distancia_acumulada_m AS metros_por_recorrer,
       ceil((pasajero.distancia_acumulada_m - colectivo.distancia_acumulada_m)
            / (25 * 1000.0 / 60)) AS minutos_estimados
FROM puntos_ruta colectivo
JOIN puntos_ruta pasajero ON pasajero.sentido_id = colectivo.sentido_id
WHERE colectivo.sentido_id = '00000000-0000-4000-8000-000000000101'
  AND colectivo.orden = 2
  AND pasajero.orden = 5;

\echo
\echo '5) Demanda de ayer por hora y sentido (panel del representante)'
SELECT d.hora, s.sentido, sum(d.avisos) AS avisos, sum(d.personas) AS personas
FROM demanda_por_tramo d
JOIN sentidos s ON s.id = d.sentido_id
WHERE s.trazado_id = '00000000-0000-4000-8000-000000000100'
  AND d.fecha = current_date - 1
GROUP BY d.hora, s.sentido
ORDER BY personas DESC
LIMIT 6;

\echo
\echo '6) Comportamiento por conductor: viajes, nota y reportes (panel)'
SELECT u.nombre_completo AS conductor,
       count(DISTINCT a.id)                                   AS abordajes,
       round(avg(c.estrellas), 1)                             AS nota_promedio,
       count(DISTINCT r.id) FILTER (WHERE r.tipo = 'queja')        AS quejas,
       count(DISTINCT r.id) FILTER (WHERE r.tipo = 'felicitacion') AS felicitaciones
FROM conductores co
JOIN usuarios u        ON u.id = co.usuario_id
LEFT JOIN jornadas j   ON j.conductor_id = co.usuario_id
LEFT JOIN abordajes a  ON a.jornada_id = j.id
LEFT JOIN calificaciones c ON c.abordaje_id = a.id
LEFT JOIN reportes r   ON r.abordaje_id = a.id
WHERE co.trazado_id = '00000000-0000-4000-8000-000000000100'
GROUP BY u.nombre_completo
ORDER BY u.nombre_completo;

\echo
\echo '7) Registrar un aviso de espera en la estadistica (suma si ya existe)'
INSERT INTO demanda_por_tramo (sentido_id, numero_tramo, fecha, hora, avisos, personas)
VALUES ('00000000-0000-4000-8000-000000000101', 3, current_date, 8, 1, 2)
ON CONFLICT (sentido_id, numero_tramo, fecha, hora)
DO UPDATE SET avisos   = demanda_por_tramo.avisos + EXCLUDED.avisos,
              personas = demanda_por_tramo.personas + EXCLUDED.personas
RETURNING numero_tramo, hora, avisos, personas;
