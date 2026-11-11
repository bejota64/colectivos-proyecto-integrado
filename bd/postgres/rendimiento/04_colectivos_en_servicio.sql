-- Lectura del mapa: colectivos en servicio con vehiculo, conductor y sentido.
SELECT v.patente, v.modelo, u.nombre_completo, s.sentido, j.asientos_disponibles
FROM jornadas j
JOIN vehiculos v ON v.id = j.vehiculo_id
JOIN usuarios u ON u.id = j.conductor_id
LEFT JOIN sentidos s ON s.id = j.sentido_actual_id
WHERE j.finalizada_en IS NULL
  AND v.trazado_id = '00000000-0000-4000-8000-000000000100';
