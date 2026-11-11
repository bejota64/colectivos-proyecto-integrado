// =====================================================================
// Sistema Integral para Colectivos - Colecciones MongoDB (MVP)
// Se ejecuta con mongosh. Version 1.0 - 08 de octubre de 2026
//
// Que va en MongoDB y por que:
//   * Datos de alto volumen y vida corta (posiciones GPS, avisos de
//     espera) que se consultan por cercania y deben borrarse solos.
//   * Datos de forma variable (registro de eventos de auditoria).
// Todo lo que necesita integridad referencial vive en PostgreSQL.
//
// Los campos *_id guardan el uuid de PostgreSQL como texto. MongoDB no
// valida esa referencia: la valida el backend antes de escribir.
//
// OJO: GeoJSON usa el orden [longitud, latitud], al reves de lo usual.
// =====================================================================

const bd = db.getSiblingDB('colectivos');

const UUID = '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

const puntoGeoJson = {
  bsonType: 'object',
  required: ['type', 'coordinates'],
  additionalProperties: false,
  properties: {
    type: { enum: ['Point'] },
    coordinates: {
      bsonType: 'array',
      minItems: 2,
      maxItems: 2,
      items: [
        { bsonType: 'number', minimum: -76.0, maximum: -66.0, description: 'longitud (Chile)' },
        { bsonType: 'number', minimum: -56.5, maximum: -17.0, description: 'latitud (Chile)' },
      ],
    },
  },
};

// Permite volver a ejecutar el script en desarrollo sin errores.
['ubicaciones_vehiculos', 'avisos_espera', 'registro_eventos'].forEach((nombre) => {
  bd.getCollection(nombre).drop();
});

// ---------------------------------------------------------------------
// 1. ubicaciones_vehiculos
//    Una posicion por cada envio de GPS del conductor (cada pocos
//    segundos). La ultima de cada jornada es la que se ve en el mapa.
//    Se borran solas a las 24 horas.
// ---------------------------------------------------------------------
bd.createCollection('ubicaciones_vehiculos', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['jornada_id', 'vehiculo_id', 'sentido_id', 'ubicacion',
                 'distancia_ruta_m', 'asientos_disponibles', 'registrada_en'],
      additionalProperties: false,
      properties: {
        _id: { bsonType: 'objectId' },
        jornada_id: { bsonType: 'string', pattern: UUID },
        vehiculo_id: { bsonType: 'string', pattern: UUID },
        sentido_id: { bsonType: 'string', pattern: UUID },
        ubicacion: puntoGeoJson,
        // Posicion proyectada sobre el recorrido, en metros desde el inicio.
        distancia_ruta_m: { bsonType: 'int', minimum: 0 },
        velocidad_kmh: { bsonType: 'number', minimum: 0, maximum: 150 },
        asientos_disponibles: { bsonType: 'int', minimum: 0, maximum: 6 },
        registrada_en: { bsonType: 'date' },
      },
    },
  },
});

bd.ubicaciones_vehiculos.createIndex({ ubicacion: '2dsphere' });
bd.ubicaciones_vehiculos.createIndex({ jornada_id: 1, registrada_en: -1 });
bd.ubicaciones_vehiculos.createIndex({ registrada_en: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

// ---------------------------------------------------------------------
// 2. avisos_espera
//    "Estoy esperando": un punto sobre el recorrido, no un paradero.
//    Un pasajero tiene como maximo un aviso. Caduca solo a los 20 minutos.
//    Al cancelar o abordar NO se borra: se marca terminado_en y deja de
//    mostrarse. Asi, si el pasajero vuelve a avisar dentro de esos 20
//    minutos, se reactiva el mismo documento y la demanda no se cuenta
//    dos veces. La demanda se suma en PostgreSQL al crear el aviso.
// ---------------------------------------------------------------------
bd.createCollection('avisos_espera', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['pasajero_id', 'sentido_id', 'ubicacion', 'distancia_ruta_m',
                 'personas', 'creado_en', 'expira_en'],
      additionalProperties: false,
      properties: {
        _id: { bsonType: 'objectId' },
        pasajero_id: { bsonType: 'string', pattern: UUID },
        sentido_id: { bsonType: 'string', pattern: UUID },
        ubicacion: puntoGeoJson,
        distancia_ruta_m: { bsonType: 'int', minimum: 0 },
        personas: { bsonType: 'int', minimum: 1, maximum: 4 },
        creado_en: { bsonType: 'date' },
        expira_en: { bsonType: 'date' },
        terminado_en: { bsonType: ['date', 'null'] },
      },
    },
  },
});

bd.avisos_espera.createIndex({ ubicacion: '2dsphere' });
bd.avisos_espera.createIndex({ pasajero_id: 1 }, { unique: true });
bd.avisos_espera.createIndex({ sentido_id: 1, distancia_ruta_m: 1 });
bd.avisos_espera.createIndex({ expira_en: 1 }, { expireAfterSeconds: 0 });

// ---------------------------------------------------------------------
// 3. registro_eventos
//    Auditoria: quien hizo que y cuando. El campo "detalle" cambia segun
//    el tipo de evento, por eso no calza en una tabla. Nunca se guardan
//    contrasenas ni tokens. Se borra solo a los 90 dias.
// ---------------------------------------------------------------------
bd.createCollection('registro_eventos', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['tipo', 'ocurrido_en'],
      properties: {
        tipo: {
          enum: ['inicio_sesion_exitoso', 'inicio_sesion_fallido', 'cierre_sesion',
                 'acceso_denegado', 'cambio_tarifa', 'inicio_jornada', 'fin_jornada',
                 'cambio_estado_reporte', 'cambio_datos_maestros', 'eliminacion_cuenta'],
        },
        usuario_id: { bsonType: ['string', 'null'], pattern: UUID },
        direccion_ip: { bsonType: 'string' },
        detalle: { bsonType: 'object' },
        ocurrido_en: { bsonType: 'date' },
      },
    },
  },
});

bd.registro_eventos.createIndex({ usuario_id: 1, ocurrido_en: -1 });
bd.registro_eventos.createIndex({ tipo: 1, ocurrido_en: -1 });
bd.registro_eventos.createIndex({ ocurrido_en: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

// ---------------------------------------------------------------------
// Datos de prueba (mismos identificadores que en PostgreSQL)
// ---------------------------------------------------------------------
const SENTIDO_IDA = '00000000-0000-4000-8000-000000000101';
const SENTIDO_VUELTA = '00000000-0000-4000-8000-000000000102';
const ahora = new Date();
const haceSegundos = (segundos) => new Date(ahora.getTime() - segundos * 1000);
const enMinutos = (minutos) => new Date(ahora.getTime() + minutos * 60 * 1000);

bd.ubicaciones_vehiculos.insertMany([
  // Colectivo ZZZZ01, en sentido ida, avanzando (tres envios seguidos).
  { jornada_id: '00000000-0000-4000-8000-000000000302', vehiculo_id: '00000000-0000-4000-8000-000000000201',
    sentido_id: SENTIDO_IDA, ubicacion: { type: 'Point', coordinates: [-70.5760, -33.6085] },
    distancia_ruta_m: NumberInt(225), velocidad_kmh: 28.0, asientos_disponibles: NumberInt(3),
    registrada_en: haceSegundos(10) },
  { jornada_id: '00000000-0000-4000-8000-000000000302', vehiculo_id: '00000000-0000-4000-8000-000000000201',
    sentido_id: SENTIDO_IDA, ubicacion: { type: 'Point', coordinates: [-70.5762, -33.6073] },
    distancia_ruta_m: NumberInt(360), velocidad_kmh: 31.5, asientos_disponibles: NumberInt(3),
    registrada_en: haceSegundos(5) },
  { jornada_id: '00000000-0000-4000-8000-000000000302', vehiculo_id: '00000000-0000-4000-8000-000000000201',
    sentido_id: SENTIDO_IDA, ubicacion: { type: 'Point', coordinates: [-70.5764, -33.6062] },
    distancia_ruta_m: NumberInt(483), velocidad_kmh: 30.0, asientos_disponibles: NumberInt(2),
    registrada_en: haceSegundos(0) },
  // Colectivo ZZZZ02, en sentido vuelta, completo.
  { jornada_id: '00000000-0000-4000-8000-000000000303', vehiculo_id: '00000000-0000-4000-8000-000000000202',
    sentido_id: SENTIDO_VUELTA, ubicacion: { type: 'Point', coordinates: [-70.5799, -33.5886] },
    distancia_ruta_m: NumberInt(1293), velocidad_kmh: 22.0, asientos_disponibles: NumberInt(0),
    registrada_en: haceSegundos(2) },
]);

bd.avisos_espera.insertMany([
  { pasajero_id: '00000000-0000-4000-8000-000000000022', sentido_id: SENTIDO_IDA,
    ubicacion: { type: 'Point', coordinates: [-70.5781, -33.5975] },
    distancia_ruta_m: NumberInt(1467), personas: NumberInt(2),
    creado_en: ahora, expira_en: enMinutos(20) },
  { pasajero_id: '00000000-0000-4000-8000-000000000023', sentido_id: SENTIDO_IDA,
    ubicacion: { type: 'Point', coordinates: [-70.5807, -33.5842] },
    distancia_ruta_m: NumberInt(2959), personas: NumberInt(1),
    creado_en: ahora, expira_en: enMinutos(20) },
]);

bd.registro_eventos.insertMany([
  { tipo: 'inicio_sesion_fallido', usuario_id: null, direccion_ip: '203.0.113.7',
    detalle: { correo_intentado: 'conductor1@colectivos.ejemplo.cl', motivo: 'contrasena_incorrecta' },
    ocurrido_en: haceSegundos(600) },
  { tipo: 'cambio_tarifa', usuario_id: '00000000-0000-4000-8000-000000000002', direccion_ip: '203.0.113.20',
    detalle: { trazado_id: '00000000-0000-4000-8000-000000000100', nombre: 'Recorrido completo',
               monto_anterior: 1400, monto_nuevo: 1500 },
    ocurrido_en: haceSegundos(60 * 60 * 24 * 10) },
  { tipo: 'inicio_jornada', usuario_id: '00000000-0000-4000-8000-000000000011', direccion_ip: '203.0.113.31',
    detalle: { jornada_id: '00000000-0000-4000-8000-000000000302', patente: 'ZZZZ01' },
    ocurrido_en: haceSegundos(60 * 60 * 3) },
]);

print('Colecciones creadas: ' + bd.getCollectionNames().sort().join(', '));
