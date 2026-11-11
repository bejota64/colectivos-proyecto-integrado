-- Escritura que ocurre con cada aviso "estoy esperando": suma al contador de demanda.
\set tramo random(0, 7)
\set hora random(6, 21)
\set personas random(1, 4)
INSERT INTO demanda_por_tramo (sentido_id, numero_tramo, fecha, hora, avisos, personas)
VALUES ('00000000-0000-4000-8000-000000000101', :tramo, current_date, :hora, 1, :personas)
ON CONFLICT (sentido_id, numero_tramo, fecha, hora)
DO UPDATE SET avisos = demanda_por_tramo.avisos + 1,
              personas = demanda_por_tramo.personas + EXCLUDED.personas;
