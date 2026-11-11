-- =====================================================================
-- Pruebas de integridad: la base debe RECHAZAR cada dato invalido.
-- Corre dentro de una transaccion que se revierte: no deja rastros.
-- Resultado esperado: todas las filas con "OK".
-- =====================================================================
BEGIN;

CREATE FUNCTION pg_temp.debe_rechazar(descripcion text, sentencia text, codigo_esperado text)
RETURNS text LANGUAGE plpgsql AS $$
BEGIN
    EXECUTE sentencia;
    RETURN 'FALLA | ' || descripcion || ' | la base acepto el dato invalido';
EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = codigo_esperado THEN
        RETURN 'OK    | ' || descripcion;
    END IF;
    RETURN 'FALLA | ' || descripcion || ' | error inesperado: ' || SQLERRM;
END;
$$;

-- Codigos: 23505 unicidad, 23514 regla CHECK, 23503 clave foranea, 23502 no nulo
SELECT resultado FROM (VALUES
    (1, pg_temp.debe_rechazar('Correo repetido',
        $s$INSERT INTO usuarios (nombre_completo, correo_electronico, contrasena_hash, rol)
           VALUES ('Persona Duplicada', 'pasajero1@colectivos.ejemplo.cl', 'x', 'pasajero')$s$, '23505')),
    (2, pg_temp.debe_rechazar('Correo con mayusculas',
        $s$INSERT INTO usuarios (nombre_completo, correo_electronico, contrasena_hash, rol)
           VALUES ('Persona Nueva', 'Nueva@Ejemplo.cl', 'x', 'pasajero')$s$, '23514')),
    (3, pg_temp.debe_rechazar('Rol inexistente',
        $s$INSERT INTO usuarios (nombre_completo, correo_electronico, contrasena_hash, rol)
           VALUES ('Persona Nueva', 'nueva@ejemplo.cl', 'x', 'superusuario')$s$, '23514')),
    (4, pg_temp.debe_rechazar('Usuario sin contrasena',
        $s$INSERT INTO usuarios (nombre_completo, correo_electronico, rol)
           VALUES ('Persona Nueva', 'nueva@ejemplo.cl', 'pasajero')$s$, '23502')),
    (5, pg_temp.debe_rechazar('Patente con formato invalido',
        $s$INSERT INTO vehiculos (trazado_id, patente, marca, modelo, anio)
           VALUES ('00000000-0000-4000-8000-000000000100', 'abc-123', 'Kia', 'Rio', 2020)$s$, '23514')),
    (6, pg_temp.debe_rechazar('Patente repetida',
        $s$INSERT INTO vehiculos (trazado_id, patente, marca, modelo, anio)
           VALUES ('00000000-0000-4000-8000-000000000100', 'ZZZZ01', 'Kia', 'Rio', 2020)$s$, '23505')),
    (7, pg_temp.debe_rechazar('Vehiculo de un trazado que no existe',
        $s$INSERT INTO vehiculos (trazado_id, patente, marca, modelo, anio)
           VALUES ('99999999-9999-4999-8999-999999999999', 'ZZZZ77', 'Kia', 'Rio', 2020)$s$, '23503')),
    (8, pg_temp.debe_rechazar('Tarifa con un cero de mas ($15.000)',
        $s$INSERT INTO tarifas (trazado_id, nombre, monto, creada_por)
           VALUES ('00000000-0000-4000-8000-000000000100', 'Error', 15000,
                   '00000000-0000-4000-8000-000000000002')$s$, '23514')),
    (9, pg_temp.debe_rechazar('Tarifa con franja horaria incompleta',
        $s$INSERT INTO tarifas (trazado_id, nombre, monto, hora_inicio, creada_por)
           VALUES ('00000000-0000-4000-8000-000000000100', 'Error', 1200, '06:00',
                   '00000000-0000-4000-8000-000000000002')$s$, '23514')),
    (10, pg_temp.debe_rechazar('Tercer sentido en un trazado',
        $s$INSERT INTO sentidos (trazado_id, sentido, origen, destino)
           VALUES ('00000000-0000-4000-8000-000000000100', 'ida', 'A', 'B')$s$, '23505')),
    (11, pg_temp.debe_rechazar('Punto de ruta fuera de Chile',
        $s$INSERT INTO puntos_ruta (sentido_id, orden, latitud, longitud)
           VALUES ('00000000-0000-4000-8000-000000000101', 99, 40.4168, -3.7038)$s$, '23514')),
    (12, pg_temp.debe_rechazar('Segunda jornada abierta del mismo conductor',
        $s$INSERT INTO jornadas (conductor_id, vehiculo_id, asientos_disponibles)
           VALUES ('00000000-0000-4000-8000-000000000011',
                   '00000000-0000-4000-8000-000000000203', 4)$s$, '23505')),
    (13, pg_temp.debe_rechazar('Vehiculo en dos jornadas abiertas',
        $s$INSERT INTO jornadas (conductor_id, vehiculo_id, asientos_disponibles)
           VALUES ('00000000-0000-4000-8000-000000000013',
                   '00000000-0000-4000-8000-000000000201', 4)$s$, '23505')),
    (14, pg_temp.debe_rechazar('Jornada de un pasajero (no es conductor)',
        $s$INSERT INTO jornadas (conductor_id, vehiculo_id, asientos_disponibles)
           VALUES ('00000000-0000-4000-8000-000000000021',
                   '00000000-0000-4000-8000-000000000203', 4)$s$, '23503')),
    (15, pg_temp.debe_rechazar('Asientos negativos',
        $s$UPDATE jornadas SET asientos_disponibles = -1
           WHERE id = '00000000-0000-4000-8000-000000000302'$s$, '23514')),
    (16, pg_temp.debe_rechazar('Jornada que termina antes de empezar',
        $s$UPDATE jornadas SET finalizada_en = iniciada_en - interval '1 hour'
           WHERE id = '00000000-0000-4000-8000-000000000302'$s$, '23514')),
    (17, pg_temp.debe_rechazar('Abordaje en una jornada que no existe',
        $s$INSERT INTO abordajes (pasajero_id, jornada_id, sentido_id, distancia_al_vehiculo_m)
           VALUES ('00000000-0000-4000-8000-000000000021',
                   '99999999-9999-4999-8999-999999999999',
                   '00000000-0000-4000-8000-000000000101', 10)$s$, '23503')),
    (18, pg_temp.debe_rechazar('Calificacion de 6 estrellas',
        $s$UPDATE calificaciones SET estrellas = 6
           WHERE abordaje_id = '00000000-0000-4000-8000-000000000403'$s$, '23514')),
    (19, pg_temp.debe_rechazar('Segunda calificacion del mismo abordaje',
        $s$INSERT INTO calificaciones (abordaje_id, estrellas)
           VALUES ('00000000-0000-4000-8000-000000000403', 1)$s$, '23505')),
    (20, pg_temp.debe_rechazar('Calificacion sin abordaje',
        $s$INSERT INTO calificaciones (abordaje_id, estrellas)
           VALUES ('99999999-9999-4999-8999-999999999999', 5)$s$, '23503')),
    (21, pg_temp.debe_rechazar('Reporte con descripcion demasiado corta',
        $s$INSERT INTO reportes (abordaje_id, tipo, categoria, descripcion)
           VALUES ('00000000-0000-4000-8000-000000000404', 'queja', 'otro', 'malo')$s$, '23514')),
    (22, pg_temp.debe_rechazar('Reporte cerrado sin responsable',
        $s$UPDATE reportes SET estado = 'cerrado'
           WHERE abordaje_id = '00000000-0000-4000-8000-000000000401'$s$, '23514')),
    (23, pg_temp.debe_rechazar('Borrar un pasajero que tiene viajes',
        $s$DELETE FROM usuarios WHERE id = '00000000-0000-4000-8000-000000000021'$s$, '23503')),
    (24, pg_temp.debe_rechazar('Borrar un vehiculo que tiene jornadas',
        $s$DELETE FROM vehiculos WHERE id = '00000000-0000-4000-8000-000000000201'$s$, '23503')),
    (25, pg_temp.debe_rechazar('Demanda con hora 24',
        $s$INSERT INTO demanda_por_tramo (sentido_id, numero_tramo, fecha, hora)
           VALUES ('00000000-0000-4000-8000-000000000101', 0, current_date, 24)$s$, '23514')),
    (26, pg_temp.debe_rechazar('Me subi marcado a 3 km del colectivo',
        $s$INSERT INTO abordajes (pasajero_id, jornada_id, sentido_id, distancia_al_vehiculo_m)
           VALUES ('00000000-0000-4000-8000-000000000023',
                   '00000000-0000-4000-8000-000000000303',
                   '00000000-0000-4000-8000-000000000102', 3000)$s$, '23514')),
    (27, pg_temp.debe_rechazar('Me subi sin distancia medida',
        $s$INSERT INTO abordajes (pasajero_id, jornada_id, sentido_id)
           VALUES ('00000000-0000-4000-8000-000000000023',
                   '00000000-0000-4000-8000-000000000303',
                   '00000000-0000-4000-8000-000000000102')$s$, '23502')),
    (28, pg_temp.debe_rechazar('Cinco asientos disponibles (el tope legal es 4)',
        $s$UPDATE jornadas SET asientos_disponibles = 5
           WHERE id = '00000000-0000-4000-8000-000000000302'$s$, '23514')),
    (29, pg_temp.debe_rechazar('Vehiculo con capacidad para 6 pasajeros',
        $s$INSERT INTO vehiculos (trazado_id, patente, marca, modelo, anio, capacidad)
           VALUES ('00000000-0000-4000-8000-000000000100', 'ZZZZ88', 'Kia', 'Rio', 2020, 6)$s$, '23514'))
) AS pruebas (numero, resultado)
ORDER BY numero;

ROLLBACK;
