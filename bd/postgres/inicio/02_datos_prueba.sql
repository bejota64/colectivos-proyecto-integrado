-- =====================================================================
-- Datos de prueba - SOLO para desarrollo y demostracion
--
-- Todo es ficticio: personas, patentes, correos y el trazado 9001.
-- Las coordenadas son aproximadas (eje Av. Concha y Toro, Puente Alto)
-- y deben reemplazarse por el recorrido real de la planilla Excel.
-- Contrasena de todas las cuentas de prueba: Clave.Prueba.2026
-- =====================================================================

-- pgcrypto se usa solo aqui, para generar hashes bcrypt reales.
-- En la aplicacion el hash lo calcula el backend, no la base.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------
-- Usuarios (1 administrador, 1 representante, 3 conductores, 3 pasajeros)
-- ---------------------------------------------------------------------
INSERT INTO usuarios (id, nombre_completo, correo_electronico, contrasena_hash, rol, telefono)
SELECT u.id::uuid, u.nombre, u.correo,
       crypt('Clave.Prueba.2026', gen_salt('bf', 10)), u.rol, u.telefono
FROM (VALUES
    ('00000000-0000-4000-8000-000000000001', 'Administradora de Plataforma', 'admin@colectivos.ejemplo.cl',        'administrador', '+56911110001'),
    ('00000000-0000-4000-8000-000000000002', 'Rosa Altamirano Vidal',        'representante@colectivos.ejemplo.cl', 'representante', '+56911110002'),
    ('00000000-0000-4000-8000-000000000011', 'Luis Fuentealba Rojas',        'conductor1@colectivos.ejemplo.cl',   'conductor',     '+56911110011'),
    ('00000000-0000-4000-8000-000000000012', 'Marta Quezada Soto',           'conductor2@colectivos.ejemplo.cl',   'conductor',     '+56911110012'),
    ('00000000-0000-4000-8000-000000000013', 'Pedro Inostroza Leal',         'conductor3@colectivos.ejemplo.cl',   'conductor',     '+56911110013'),
    ('00000000-0000-4000-8000-000000000021', 'Camila Orellana Paz',          'pasajero1@colectivos.ejemplo.cl',    'pasajero',      NULL),
    ('00000000-0000-4000-8000-000000000022', 'Diego Sanhueza Mora',          'pasajero2@colectivos.ejemplo.cl',    'pasajero',      NULL),
    ('00000000-0000-4000-8000-000000000023', 'Ana Riquelme Tapia',           'pasajero3@colectivos.ejemplo.cl',    'pasajero',      NULL)
) AS u (id, nombre, correo, rol, telefono);

INSERT INTO consentimientos (usuario_id, tipo, version_politica)
SELECT u.id, t.tipo, '1.0'
FROM usuarios u
CROSS JOIN (VALUES ('terminos_de_uso'), ('politica_de_privacidad')) AS t (tipo);

-- Geolocalizacion: en los datos de prueba ya la aceptaron conductores y pasajeros.
-- En la aplicacion real este consentimiento no se da al registrarse: se pide
-- la primera vez que la persona usa una funcion que envia su ubicacion.
INSERT INTO consentimientos (usuario_id, tipo, version_politica)
SELECT id, 'geolocalizacion', '1.0' FROM usuarios WHERE rol IN ('conductor', 'pasajero');

-- ---------------------------------------------------------------------
-- Trazado piloto, sentidos y geometria
-- ---------------------------------------------------------------------
INSERT INTO trazados (id, codigo, nombre, comuna, representante_id) VALUES
    ('00000000-0000-4000-8000-000000000100', '9001',
     'Plaza Puente Alto - Hospital Sotero del Rio (ficticio)', 'Puente Alto',
     '00000000-0000-4000-8000-000000000002');

INSERT INTO sentidos (id, trazado_id, sentido, origen, destino) VALUES
    ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000100',
     'ida', 'Plaza Puente Alto', 'Hospital Sotero del Rio'),
    ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000100',
     'vuelta', 'Hospital Sotero del Rio', 'Plaza Puente Alto');

INSERT INTO puntos_ruta (sentido_id, orden, latitud, longitud) VALUES
    ('00000000-0000-4000-8000-000000000101', 1, -33.6105, -70.5757),
    ('00000000-0000-4000-8000-000000000101', 2, -33.6062, -70.5764),
    ('00000000-0000-4000-8000-000000000101', 3, -33.6018, -70.5772),
    ('00000000-0000-4000-8000-000000000101', 4, -33.5975, -70.5781),
    ('00000000-0000-4000-8000-000000000101', 5, -33.5931, -70.5790),
    ('00000000-0000-4000-8000-000000000101', 6, -33.5886, -70.5799),
    ('00000000-0000-4000-8000-000000000101', 7, -33.5842, -70.5807),
    ('00000000-0000-4000-8000-000000000101', 8, -33.5798, -70.5814),
    ('00000000-0000-4000-8000-000000000101', 9, -33.5772, -70.5818);

-- La vuelta recorre los mismos puntos en orden inverso (simplificacion
-- de prueba: en la realidad ida y vuelta pueden usar calles distintas).
INSERT INTO puntos_ruta (sentido_id, orden, latitud, longitud)
SELECT '00000000-0000-4000-8000-000000000102', 10 - orden, latitud, longitud
FROM puntos_ruta
WHERE sentido_id = '00000000-0000-4000-8000-000000000101';

-- Calcula la distancia acumulada desde el inicio de cada sentido.
UPDATE puntos_ruta AS p
SET distancia_acumulada_m = c.acumulada
FROM (
    SELECT sentido_id, orden,
           round(sum(tramo) OVER (PARTITION BY sentido_id ORDER BY orden))::integer AS acumulada
    FROM (
        SELECT sentido_id, orden,
               coalesce(distancia_metros(
                   lag(latitud)  OVER (PARTITION BY sentido_id ORDER BY orden),
                   lag(longitud) OVER (PARTITION BY sentido_id ORDER BY orden),
                   latitud, longitud), 0) AS tramo
        FROM puntos_ruta
    ) AS tramos
) AS c
WHERE p.sentido_id = c.sentido_id AND p.orden = c.orden;

INSERT INTO puntos_referencia (trazado_id, nombre, tipo, latitud, longitud) VALUES
    ('00000000-0000-4000-8000-000000000100', 'Terminal Plaza Puente Alto',       'terminal',    -33.6105, -70.5757),
    ('00000000-0000-4000-8000-000000000100', 'Combinacion Metro (referencia)',   'combinacion', -33.5975, -70.5781),
    ('00000000-0000-4000-8000-000000000100', 'Terminal Hospital Sotero del Rio', 'terminal',    -33.5772, -70.5818);

-- ---------------------------------------------------------------------
-- Tarifas (rango acordado para el piloto: $1.000 a $3.000)
-- ---------------------------------------------------------------------
INSERT INTO tarifas (trazado_id, nombre, monto, hora_inicio, hora_fin, vigente_desde, vigente_hasta, creada_por) VALUES
    -- Precio anterior, ya cerrado: demuestra el historial de cambios.
    ('00000000-0000-4000-8000-000000000100', 'Recorrido completo', 1400, '06:00', '22:00',
     now() - interval '90 days', now() - interval '10 days', '00000000-0000-4000-8000-000000000002'),
    -- Precios vigentes.
    ('00000000-0000-4000-8000-000000000100', 'Tramo corto',        1000, '06:00', '22:00',
     now() - interval '90 days', NULL, '00000000-0000-4000-8000-000000000002'),
    ('00000000-0000-4000-8000-000000000100', 'Recorrido completo', 1500, '06:00', '22:00',
     now() - interval '10 days', NULL, '00000000-0000-4000-8000-000000000002'),
    ('00000000-0000-4000-8000-000000000100', 'Nocturna',           3000, '22:00', '06:00',
     now() - interval '90 days', NULL, '00000000-0000-4000-8000-000000000002');

-- ---------------------------------------------------------------------
-- Flota y conductores
-- ---------------------------------------------------------------------
INSERT INTO conductores (usuario_id, trazado_id) VALUES
    ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000100'),
    ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000100'),
    ('00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000100');

INSERT INTO vehiculos (id, trazado_id, patente, marca, modelo, anio, capacidad) VALUES
    ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000100', 'ZZZZ01', 'Nissan',    'Versa',  2021, 4),
    ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000100', 'ZZZZ02', 'Chevrolet', 'Sail',   2019, 4),
    ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000100', 'ZZ9903', 'Hyundai',   'Accent', 2016, 4);

-- ---------------------------------------------------------------------
-- Operacion: jornadas, abordajes, calificaciones y reportes
-- ---------------------------------------------------------------------
INSERT INTO jornadas (id, conductor_id, vehiculo_id, sentido_actual_id, asientos_disponibles, iniciada_en, finalizada_en) VALUES
    -- Jornada de ayer, ya cerrada.
    ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000013',
     '00000000-0000-4000-8000-000000000203', NULL, 4,
     now() - interval '30 hours', now() - interval '22 hours'),
    -- Dos colectivos en servicio ahora.
    ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000011',
     '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000101', 2,
     now() - interval '3 hours', NULL),
    ('00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000012',
     '00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000102', 0,
     now() - interval '2 hours', NULL);

INSERT INTO abordajes (id, pasajero_id, jornada_id, sentido_id, distancia_al_vehiculo_m, abordado_en) VALUES
    ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000021',
     '00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000101', 12, now() - interval '28 hours'),
    ('00000000-0000-4000-8000-000000000402', '00000000-0000-4000-8000-000000000022',
     '00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000102', 35, now() - interval '25 hours'),
    ('00000000-0000-4000-8000-000000000403', '00000000-0000-4000-8000-000000000021',
     '00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000101', 8, now() - interval '2 hours'),
    ('00000000-0000-4000-8000-000000000404', '00000000-0000-4000-8000-000000000023',
     '00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000101', 60, now() - interval '90 minutes'),
    ('00000000-0000-4000-8000-000000000405', '00000000-0000-4000-8000-000000000022',
     '00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000102', 21, now() - interval '40 minutes');

INSERT INTO calificaciones (abordaje_id, estrellas) VALUES
    ('00000000-0000-4000-8000-000000000401', 2),
    ('00000000-0000-4000-8000-000000000402', 3),
    ('00000000-0000-4000-8000-000000000403', 5),
    ('00000000-0000-4000-8000-000000000404', 4),
    ('00000000-0000-4000-8000-000000000405', 5);

INSERT INTO reportes (abordaje_id, tipo, categoria, descripcion, estado, respuesta, gestionado_por, cerrado_en) VALUES
    ('00000000-0000-4000-8000-000000000401', 'queja', 'uso_de_celular',
     'El conductor fue escribiendo en el celular durante varias cuadras.',
     'pendiente', NULL, NULL, NULL),
    ('00000000-0000-4000-8000-000000000403', 'felicitacion', 'buen_servicio',
     'Muy amable y manejo con cuidado todo el recorrido.',
     'cerrado', 'Se traspaso la felicitacion al conductor.',
     '00000000-0000-4000-8000-000000000002', now() - interval '1 hour');

-- ---------------------------------------------------------------------
-- Demanda de ayer: avisos por tramo y hora, con dos horas punta
-- ---------------------------------------------------------------------
INSERT INTO demanda_por_tramo (sentido_id, numero_tramo, fecha, hora, avisos, personas)
SELECT s.id, t.numero_tramo, current_date - 1, h.hora, d.avisos, d.avisos + (d.avisos / 3)
FROM sentidos s
CROSS JOIN generate_series(0, 7) AS t (numero_tramo)
CROSS JOIN generate_series(6, 21) AS h (hora)
CROSS JOIN LATERAL (
    SELECT CASE
        -- Punta de manana en la ida, punta de tarde en la vuelta.
        WHEN s.sentido = 'ida'    AND h.hora IN (7, 8)   THEN 9 - t.numero_tramo
        WHEN s.sentido = 'vuelta' AND h.hora IN (18, 19) THEN 9 - t.numero_tramo
        ELSE 1 + ((h.hora + t.numero_tramo) % 3)
    END AS avisos
) AS d;
