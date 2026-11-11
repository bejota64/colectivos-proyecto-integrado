// =====================================================================
// Pruebas del validador de MongoDB: la base debe RECHAZAR cada aviso
// invalido con el codigo esperado (121 = no cumple el validador,
// 11000 = indice unico). Primero comprueba que un aviso valido se acepta,
// para que cada rechazo se deba solo al dato que se cambio.
// No deja rastros: al final borra el aviso de control.
//
// Uso, desde la carpeta colectivos/:
//   docker compose exec -T mongo sh -c 'mongosh --quiet -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --file /scripts/pruebas_validador.js'
// Resultado esperado: todas las lineas con "OK".
// =====================================================================

{
const bd = db.getSiblingDB('colectivos');
const PASAJERO_CONTROL = '00000000-0000-4000-8000-000000000021';

const avisoValido = () => ({
  pasajero_id: PASAJERO_CONTROL,
  sentido_id: '00000000-0000-4000-8000-000000000101',
  ubicacion: { type: 'Point', coordinates: [-70.5781, -33.5975] },   // [longitud, latitud]
  distancia_ruta_m: NumberInt(1467),
  personas: NumberInt(1),
  creado_en: new Date(),
  expira_en: new Date(Date.now() + 20 * 60 * 1000),
});

const resultados = [];
const anotar = (estado, descripcion, detalle) =>
  resultados.push(estado + ' | ' + descripcion + (detalle ? ' | ' + detalle : ''));

// Funcion flecha (no "function"): mongosh reescribe los scripts y saca las
// declaraciones "function" de su bloque, donde ya no ven las constantes.
const debeRechazar = (descripcion, cambiar, codigoEsperado) => {
  const aviso = avisoValido();
  cambiar(aviso);
  try {
    bd.avisos_espera.insertOne(aviso);
    bd.avisos_espera.deleteOne({ _id: aviso._id });
    anotar('FALLA', descripcion, 'la base acepto el dato invalido');
  } catch (error) {
    if (error.code === codigoEsperado) {
      anotar('OK   ', descripcion, 'codigo ' + error.code);
    } else {
      anotar('FALLA', descripcion, 'error inesperado ' + error.code + ': ' + error.message);
    }
  }
};

bd.avisos_espera.deleteOne({ pasajero_id: PASAJERO_CONTROL });   // por si quedo de una ejecucion anterior

// Control: el aviso valido se acepta y queda activo.
try {
  bd.avisos_espera.insertOne(avisoValido());
  anotar('OK   ', 'Control: un aviso valido se acepta');
} catch (error) {
  anotar('FALLA', 'Control: un aviso valido se acepta', error.code + ': ' + error.message);
}

const otroPasajero = (a) => { a.pasajero_id = '00000000-0000-4000-8000-000000000024'; };

debeRechazar('Coordenadas invertidas (latitud y longitud al reves)', (a) => {
  otroPasajero(a); a.ubicacion.coordinates = [-33.5975, -70.5781];
}, 121);
debeRechazar('Punto fuera de Chile (Buenos Aires)', (a) => {
  otroPasajero(a); a.ubicacion.coordinates = [-58.3816, -34.6037];
}, 121);
debeRechazar('Grupo de 5 personas (el tope legal es 4)', (a) => {
  otroPasajero(a); a.personas = NumberInt(5);
}, 121);
debeRechazar('Grupo de 0 personas', (a) => {
  otroPasajero(a); a.personas = NumberInt(0);
}, 121);
debeRechazar('Distancia negativa sobre la ruta', (a) => {
  otroPasajero(a); a.distancia_ruta_m = NumberInt(-10);
}, 121);
debeRechazar('Aviso sin sentido de viaje', (a) => {
  otroPasajero(a); delete a.sentido_id;
}, 121);
debeRechazar('Identificador de pasajero que no es UUID', (a) => {
  a.pasajero_id = 'pasajero-123';
}, 121);
debeRechazar('Campo no previsto (nombre del pasajero)', (a) => {
  otroPasajero(a); a.nombre = 'Ana';
}, 121);
debeRechazar('Segundo aviso activo del mismo pasajero', () => {}, 11000);

bd.avisos_espera.deleteOne({ pasajero_id: PASAJERO_CONTROL });

resultados.forEach((linea) => print(linea));
const fallas = resultados.filter((linea) => linea.startsWith('FALLA')).length;
print('(' + resultados.length + ' comprobaciones, ' + fallas + ' fallas)');
}
