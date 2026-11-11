-- =====================================================================
-- Sistema Integral para Colectivos - Esquema PostgreSQL (MVP)
-- Version 1.1 - 08 de octubre de 2026
--   1.1: tope de 4 pasajeros (limite legal vigente) y evidencia de
--        cercania en los abordajes.
--
-- Convenciones:
--   * Nombres 100% en espanol, en minusculas y sin tildes ni "ñ"
--     (por eso "anio" y "contrasena"): evita problemas de codificacion.
--   * Clave primaria "id" de tipo uuid: no se puede adivinar el id
--     siguiente, lo que dificulta recorrer registros ajenos.
--   * Fechas con zona horaria (timestamptz). La API entrega ISO 8601.
--   * Dinero en pesos enteros (integer). Nunca decimales.
--   * Las claves foraneas usan ON DELETE RESTRICT salvo que se indique:
--     no se borra historial por accidente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Funciones de apoyo
-- ---------------------------------------------------------------------

-- Distancia en metros entre dos coordenadas (formula de Haversine).
CREATE FUNCTION distancia_metros(
    latitud_1 double precision, longitud_1 double precision,
    latitud_2 double precision, longitud_2 double precision
) RETURNS double precision
LANGUAGE sql IMMUTABLE AS $$
    SELECT 2 * 6371000 * asin(sqrt(
        power(sin(radians(latitud_2 - latitud_1) / 2), 2)
        + cos(radians(latitud_1)) * cos(radians(latitud_2))
          * power(sin(radians(longitud_2 - longitud_1) / 2), 2)
    ));
$$;

-- Mantiene al dia la columna actualizado_en.
CREATE FUNCTION marcar_actualizacion() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.actualizado_en := now();
    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- 1. Identidad y acceso
-- ---------------------------------------------------------------------

CREATE TABLE usuarios (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_completo     text NOT NULL,
    correo_electronico  text NOT NULL,
    contrasena_hash     text NOT NULL,
    rol                 text NOT NULL,
    telefono            text,
    activo              boolean NOT NULL DEFAULT true,
    creado_en           timestamptz NOT NULL DEFAULT now(),
    actualizado_en      timestamptz NOT NULL DEFAULT now(),
    -- Derecho de supresion: la cuenta se anonimiza y se marca aqui,
    -- asi el historial de viajes y reportes sigue siendo consistente.
    eliminado_en        timestamptz,
    CONSTRAINT usuarios_correo_unico UNIQUE (correo_electronico),
    CONSTRAINT usuarios_correo_en_minusculas
        CHECK (correo_electronico = lower(correo_electronico)),
    CONSTRAINT usuarios_correo_formato
        CHECK (correo_electronico ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    CONSTRAINT usuarios_nombre_largo
        CHECK (char_length(btrim(nombre_completo)) BETWEEN 3 AND 120),
    CONSTRAINT usuarios_rol_valido
        CHECK (rol IN ('pasajero', 'conductor', 'representante', 'administrador')),
    CONSTRAINT usuarios_telefono_formato
        CHECK (telefono IS NULL OR telefono ~ '^\+?[0-9]{8,15}$')
);

CREATE TRIGGER usuarios_marcar_actualizacion
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION marcar_actualizacion();

-- Evidencia de consentimiento (Ley 19.628 y Ley 21.719).
CREATE TABLE consentimientos (
    usuario_id        uuid NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
    tipo              text NOT NULL,
    version_politica  text NOT NULL,
    aceptado_en       timestamptz NOT NULL DEFAULT now(),
    revocado_en       timestamptz,
    PRIMARY KEY (usuario_id, tipo, version_politica),
    CONSTRAINT consentimientos_tipo_valido
        CHECK (tipo IN ('terminos_de_uso', 'politica_de_privacidad', 'geolocalizacion')),
    CONSTRAINT consentimientos_fechas_coherentes
        CHECK (revocado_en IS NULL OR revocado_en >= aceptado_en)
);

-- Tokens de refresco. Se guarda solo el hash: si se filtra la base,
-- los tokens no sirven para iniciar sesion.
CREATE TABLE tokens_refresco (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id   uuid NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
    token_hash   text NOT NULL,
    expira_en    timestamptz NOT NULL,
    revocado_en  timestamptz,
    creado_en    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tokens_refresco_hash_unico UNIQUE (token_hash),
    CONSTRAINT tokens_refresco_expira_despues CHECK (expira_en > creado_en)
);

CREATE INDEX tokens_refresco_por_usuario ON tokens_refresco (usuario_id);

-- ---------------------------------------------------------------------
-- 2. Datos maestros del trazado (reemplaza las planillas Excel)
-- ---------------------------------------------------------------------

-- Recorrido inscrito en el Registro Nacional, con su representante legal.
CREATE TABLE trazados (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo            text NOT NULL,
    nombre            text NOT NULL,
    comuna            text NOT NULL,
    -- Regla de aplicacion: este usuario debe tener rol 'representante'.
    representante_id  uuid NOT NULL REFERENCES usuarios (id),
    activo            boolean NOT NULL DEFAULT true,
    creado_en         timestamptz NOT NULL DEFAULT now(),
    actualizado_en    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT trazados_codigo_unico UNIQUE (codigo)
);

CREATE INDEX trazados_por_representante ON trazados (representante_id);

CREATE TRIGGER trazados_marcar_actualizacion
    BEFORE UPDATE ON trazados
    FOR EACH ROW EXECUTE FUNCTION marcar_actualizacion();

-- Cada trazado tiene dos sentidos: ida y vuelta.
CREATE TABLE sentidos (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trazado_id  uuid NOT NULL REFERENCES trazados (id),
    sentido     text NOT NULL,
    origen      text NOT NULL,
    destino     text NOT NULL,
    CONSTRAINT sentidos_valor_valido CHECK (sentido IN ('ida', 'vuelta')),
    CONSTRAINT sentidos_uno_por_trazado UNIQUE (trazado_id, sentido)
);

-- Geometria del recorrido: puntos ordenados que forman la linea.
-- No hay paraderos: el pasajero aborda en cualquier punto de esta linea.
-- distancia_acumulada_m permite calcular minutos estimados y tramos
-- de demanda con una simple resta.
CREATE TABLE puntos_ruta (
    sentido_id              uuid NOT NULL REFERENCES sentidos (id) ON DELETE CASCADE,
    orden                   integer NOT NULL,
    latitud                 numeric(9, 6) NOT NULL,
    longitud                numeric(9, 6) NOT NULL,
    distancia_acumulada_m   integer NOT NULL DEFAULT 0,
    PRIMARY KEY (sentido_id, orden),
    CONSTRAINT puntos_ruta_orden_positivo CHECK (orden >= 1),
    CONSTRAINT puntos_ruta_latitud_chile CHECK (latitud BETWEEN -56.5 AND -17.0),
    CONSTRAINT puntos_ruta_longitud_chile CHECK (longitud BETWEEN -76.0 AND -66.0),
    CONSTRAINT puntos_ruta_distancia_no_negativa CHECK (distancia_acumulada_m >= 0)
);

-- Lugares fijos conocidos: terminal de salida y puntos de combinacion.
-- Son solo referencias en el mapa, no paradas obligatorias.
CREATE TABLE puntos_referencia (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trazado_id  uuid NOT NULL REFERENCES trazados (id),
    nombre      text NOT NULL,
    tipo        text NOT NULL,
    latitud     numeric(9, 6) NOT NULL,
    longitud    numeric(9, 6) NOT NULL,
    CONSTRAINT puntos_referencia_tipo_valido
        CHECK (tipo IN ('terminal', 'combinacion', 'otro')),
    CONSTRAINT puntos_referencia_latitud_chile CHECK (latitud BETWEEN -56.5 AND -17.0),
    CONSTRAINT puntos_referencia_longitud_chile CHECK (longitud BETWEEN -76.0 AND -66.0)
);

CREATE INDEX puntos_referencia_por_trazado ON puntos_referencia (trazado_id);

-- Tarifas. Cambiar un precio = cerrar la fila vigente (vigente_hasta)
-- y crear una nueva: queda el historial y se puede avisar el cambio.
CREATE TABLE tarifas (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trazado_id     uuid NOT NULL REFERENCES trazados (id),
    nombre         text NOT NULL,
    monto          integer NOT NULL,
    -- Franja horaria; ambas nulas = todo el dia. Puede cruzar la
    -- medianoche (por ejemplo 22:00 a 06:00).
    hora_inicio    time,
    hora_fin       time,
    vigente_desde  timestamptz NOT NULL DEFAULT now(),
    vigente_hasta  timestamptz,
    creada_por     uuid NOT NULL REFERENCES usuarios (id),
    creado_en      timestamptz NOT NULL DEFAULT now(),
    -- Tope de seguridad contra errores de digitacion (un cero de mas).
    CONSTRAINT tarifas_monto_razonable CHECK (monto BETWEEN 500 AND 10000),
    CONSTRAINT tarifas_franja_completa
        CHECK ((hora_inicio IS NULL) = (hora_fin IS NULL)),
    CONSTRAINT tarifas_vigencia_coherente
        CHECK (vigente_hasta IS NULL OR vigente_hasta > vigente_desde)
);

CREATE INDEX tarifas_por_trazado ON tarifas (trazado_id, vigente_desde DESC);

-- ---------------------------------------------------------------------
-- 3. Flota y conductores
-- ---------------------------------------------------------------------

-- Datos del conductor que no tienen los demas usuarios (relacion 1 a 1).
CREATE TABLE conductores (
    usuario_id   uuid PRIMARY KEY REFERENCES usuarios (id),
    trazado_id   uuid NOT NULL REFERENCES trazados (id),
    habilitado   boolean NOT NULL DEFAULT true,
    creado_en    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX conductores_por_trazado ON conductores (trazado_id);

-- El vehiculo NO tiene conductor fijo: quien lo maneja se sabe por la
-- jornada. Asi se cubren turnos y la diferencia entre dueno y chofer.
CREATE TABLE vehiculos (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trazado_id      uuid NOT NULL REFERENCES trazados (id),
    patente         text NOT NULL,
    marca           text NOT NULL,
    modelo          text NOT NULL,
    anio            smallint NOT NULL,
    capacidad       smallint NOT NULL DEFAULT 4,
    activo          boolean NOT NULL DEFAULT true,
    creado_en       timestamptz NOT NULL DEFAULT now(),
    actualizado_en  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT vehiculos_patente_unica UNIQUE (patente),
    -- Formatos chilenos: AA1234 (antiguo) o BBBB12 (actual), sin guiones.
    CONSTRAINT vehiculos_patente_formato
        CHECK (patente ~ '^([A-Z]{2}[0-9]{4}|[A-Z]{4}[0-9]{2})$'),
    CONSTRAINT vehiculos_anio_valido CHECK (anio BETWEEN 2000 AND 2100),
    -- Limite legal vigente: conductor mas 4 pasajeros (decreto 212 de 1992).
    -- Si la norma cambia, se ajusta aqui y en jornadas_asientos_validos.
    CONSTRAINT vehiculos_capacidad_valida CHECK (capacidad BETWEEN 1 AND 4)
);

CREATE INDEX vehiculos_por_trazado ON vehiculos (trazado_id);

CREATE TRIGGER vehiculos_marcar_actualizacion
    BEFORE UPDATE ON vehiculos
    FOR EACH ROW EXECUTE FUNCTION marcar_actualizacion();

-- ---------------------------------------------------------------------
-- 4. Operacion diaria
-- ---------------------------------------------------------------------

-- Jornada: desde que el conductor "se pone disponible" hasta que avisa
-- que se retira. Es la entidad central: une conductor, vehiculo y momento.
-- Regla de aplicacion: conductor y vehiculo deben ser del mismo trazado,
-- y asientos_disponibles no puede superar la capacidad del vehiculo.
CREATE TABLE jornadas (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conductor_id           uuid NOT NULL REFERENCES conductores (usuario_id),
    vehiculo_id            uuid NOT NULL REFERENCES vehiculos (id),
    sentido_actual_id      uuid REFERENCES sentidos (id),
    asientos_disponibles   smallint NOT NULL,
    iniciada_en            timestamptz NOT NULL DEFAULT now(),
    finalizada_en          timestamptz,
    CONSTRAINT jornadas_asientos_validos CHECK (asientos_disponibles BETWEEN 0 AND 4),
    CONSTRAINT jornadas_fechas_coherentes
        CHECK (finalizada_en IS NULL OR finalizada_en > iniciada_en)
);

-- Un conductor no puede tener dos jornadas abiertas a la vez,
-- y un vehiculo no puede estar en dos jornadas abiertas a la vez.
CREATE UNIQUE INDEX jornadas_una_abierta_por_conductor
    ON jornadas (conductor_id) WHERE finalizada_en IS NULL;
CREATE UNIQUE INDEX jornadas_una_abierta_por_vehiculo
    ON jornadas (vehiculo_id) WHERE finalizada_en IS NULL;
CREATE INDEX jornadas_por_conductor ON jornadas (conductor_id, iniciada_en DESC);
CREATE INDEX jornadas_por_vehiculo ON jornadas (vehiculo_id, iniciada_en DESC);

-- "Me subi": el pasajero declara que abordo un colectivo en servicio.
-- Es lo que habilita calificar y reportar (solo opina quien viajo).
-- Regla de aplicacion: el backend solo acepta el abordaje si el pasajero
-- esta a 200 m o menos de la ultima posicion del colectivo (de menos de
-- 60 segundos). Se guarda la distancia medida, no la ubicacion del
-- pasajero: sirve de evidencia ante una queja y no expone donde estaba.
CREATE TABLE abordajes (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pasajero_id   uuid NOT NULL REFERENCES usuarios (id),
    jornada_id    uuid NOT NULL REFERENCES jornadas (id),
    sentido_id    uuid NOT NULL REFERENCES sentidos (id),
    distancia_al_vehiculo_m  integer NOT NULL,
    abordado_en   timestamptz NOT NULL DEFAULT now(),
    -- Tope de respaldo: aunque falle la validacion del backend, la base
    -- no registra un abordaje a mas de 500 m del colectivo.
    CONSTRAINT abordajes_cerca_del_vehiculo
        CHECK (distancia_al_vehiculo_m BETWEEN 0 AND 500)
);

CREATE INDEX abordajes_por_pasajero ON abordajes (pasajero_id, abordado_en DESC);
CREATE INDEX abordajes_por_jornada ON abordajes (jornada_id);

-- Una calificacion por abordaje (relacion 1 a 1).
CREATE TABLE calificaciones (
    abordaje_id  uuid PRIMARY KEY REFERENCES abordajes (id),
    estrellas    smallint NOT NULL,
    creada_en    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT calificaciones_estrellas_validas CHECK (estrellas BETWEEN 1 AND 5)
);

-- Quejas y felicitaciones, con seguimiento por parte del representante.
CREATE TABLE reportes (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    abordaje_id     uuid NOT NULL REFERENCES abordajes (id),
    tipo            text NOT NULL,
    categoria       text NOT NULL,
    descripcion     text NOT NULL,
    estado          text NOT NULL DEFAULT 'pendiente',
    respuesta       text,
    gestionado_por  uuid REFERENCES usuarios (id),
    creado_en       timestamptz NOT NULL DEFAULT now(),
    cerrado_en      timestamptz,
    CONSTRAINT reportes_uno_por_abordaje UNIQUE (abordaje_id),
    CONSTRAINT reportes_tipo_valido CHECK (tipo IN ('queja', 'felicitacion')),
    CONSTRAINT reportes_categoria_valida CHECK (categoria IN (
        'conduccion_riesgosa', 'uso_de_celular', 'sospecha_de_alcohol',
        'trato_al_pasajero', 'cobro_incorrecto', 'buen_servicio', 'otro')),
    CONSTRAINT reportes_descripcion_largo
        CHECK (char_length(btrim(descripcion)) BETWEEN 10 AND 1000),
    CONSTRAINT reportes_estado_valido
        CHECK (estado IN ('pendiente', 'en_revision', 'cerrado')),
    -- No se puede cerrar un reporte sin dejar quien lo cerro y cuando.
    CONSTRAINT reportes_cierre_completo CHECK (
        estado <> 'cerrado'
        OR (gestionado_por IS NOT NULL AND cerrado_en IS NOT NULL))
);

CREATE INDEX reportes_por_estado ON reportes (estado, creado_en DESC);

-- ---------------------------------------------------------------------
-- 5. Estadistica de demanda (responde al "se trabaja a ciegas")
-- ---------------------------------------------------------------------

-- Contador de avisos "estoy esperando" por tramo de 500 m y por hora.
-- No guarda quien espero: es un agregado anonimo (privacidad por diseno).
-- Los avisos individuales viven en MongoDB y caducan solos.
CREATE TABLE demanda_por_tramo (
    sentido_id     uuid NOT NULL REFERENCES sentidos (id),
    numero_tramo   integer NOT NULL,
    fecha          date NOT NULL,
    hora           smallint NOT NULL,
    avisos         integer NOT NULL DEFAULT 0,
    personas       integer NOT NULL DEFAULT 0,
    PRIMARY KEY (sentido_id, numero_tramo, fecha, hora),
    CONSTRAINT demanda_tramo_no_negativo CHECK (numero_tramo >= 0),
    CONSTRAINT demanda_hora_valida CHECK (hora BETWEEN 0 AND 23),
    CONSTRAINT demanda_contadores_no_negativos CHECK (avisos >= 0 AND personas >= 0)
);

CREATE INDEX demanda_por_fecha ON demanda_por_tramo (fecha, hora);
