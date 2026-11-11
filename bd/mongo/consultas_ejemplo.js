// =====================================================================
// Consultas de ejemplo en MongoDB. Ejecutar con mongosh despues de
// 01_colecciones.js. Cada una responde a una pantalla del MVP.
// =====================================================================

{  // bloque: permite cargar este archivo en una sesion donde ya existe "bd"

const bd = db.getSiblingDB('colectivos');
const SENTIDO_IDA = '00000000-0000-4000-8000-000000000101';

// Las consultas 1 y 4 solo miran los ultimos 2 minutos, como el mapa real. Los datos de
// prueba se crean al levantar la base: pasado ese tiempo, esas dos devuelven [].

print('\n1) Ultima posicion de cada colectivo en servicio (mapa del pasajero)');
printjson(bd.ubicaciones_vehiculos.aggregate([
  { $match: { registrada_en: { $gte: new Date(Date.now() - 2 * 60 * 1000) } } },
  { $sort: { jornada_id: 1, registrada_en: -1 } },
  { $group: {
      _id: '$jornada_id',
      vehiculo_id: { $first: '$vehiculo_id' },
      sentido_id: { $first: '$sentido_id' },
      ubicacion: { $first: '$ubicacion' },
      distancia_ruta_m: { $first: '$distancia_ruta_m' },
      asientos_disponibles: { $first: '$asientos_disponibles' },
      registrada_en: { $first: '$registrada_en' },
  } },
]).toArray());

print('\n2) Pasajeros esperando mas adelante en el mismo sentido (vista del conductor)');
print('   Colectivo en el metro 483 del sentido ida:');
printjson(bd.avisos_espera.find(
  { sentido_id: SENTIDO_IDA, distancia_ruta_m: { $gt: 483 }, expira_en: { $gt: new Date() }, terminado_en: null },
  { _id: 0, pasajero_id: 0, terminado_en: 0 },   // el conductor no necesita saber quien es
).sort({ distancia_ruta_m: 1 }).toArray());

print('\n3) Total de personas esperando por sentido (contador en pantalla)');
printjson(bd.avisos_espera.aggregate([
  { $match: { expira_en: { $gt: new Date() }, terminado_en: null } },
  { $group: { _id: '$sentido_id', avisos: { $sum: 1 }, personas: { $sum: '$personas' } } },
]).toArray());

print('\n4) Posiciones recientes de colectivos a menos de 800 m de un punto (consulta geoespacial)');
printjson(bd.ubicaciones_vehiculos.find({
  ubicacion: {
    $near: {
      $geometry: { type: 'Point', coordinates: [-70.5772, -33.6018] },   // [longitud, latitud]
      $maxDistance: 800,
    },
  },
  registrada_en: { $gte: new Date(Date.now() - 2 * 60 * 1000) },
}, { _id: 0, vehiculo_id: 1, asientos_disponibles: 1, registrada_en: 1 }).toArray());

print('\n5) Intentos fallidos de inicio de sesion por IP en la ultima hora (seguridad)');
printjson(bd.registro_eventos.aggregate([
  { $match: { tipo: 'inicio_sesion_fallido', ocurrido_en: { $gte: new Date(Date.now() - 60 * 60 * 1000) } } },
  { $group: { _id: '$direccion_ip', intentos: { $sum: 1 } } },
  { $sort: { intentos: -1 } },
]).toArray());

print('\n6) El validador rechaza un documento invalido (coordenadas invertidas)');
try {
  bd.avisos_espera.insertOne({
    pasajero_id: '00000000-0000-4000-8000-000000000021', sentido_id: SENTIDO_IDA,
    ubicacion: { type: 'Point', coordinates: [-33.5975, -70.5781] },   // latitud y longitud al reves
    distancia_ruta_m: NumberInt(1467), personas: NumberInt(1),
    creado_en: new Date(), expira_en: new Date(Date.now() + 20 * 60 * 1000),
  });
  print('FALLA: MongoDB acepto el documento invalido');
} catch (error) {
  if (error.code === 121) {
    print('OK: el validador rechazo el documento (codigo 121)');
  } else {
    print('FALLA: rechazado por otra causa (' + error.code + ': ' + error.message + ')');
  }
}

}
