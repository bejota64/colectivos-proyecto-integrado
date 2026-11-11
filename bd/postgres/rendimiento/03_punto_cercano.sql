-- Ubica una posicion GPS sobre el recorrido: se usa al recibir un aviso o un abordaje.
\set dlat random(0, 330)
\set dlon random(0, 60)
SELECT orden, distancia_acumulada_m
FROM puntos_ruta
WHERE sentido_id = '00000000-0000-4000-8000-000000000101'
ORDER BY distancia_metros(-33.6105 + :dlat / 10000.0, -70.5757 - :dlon / 10000.0, latitud, longitud)
LIMIT 1;
