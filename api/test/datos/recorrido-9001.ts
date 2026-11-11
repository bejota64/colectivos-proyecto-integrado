import type { PuntoRuta } from '../../src/comun/geo';
import type { ConsentimientosRepositorio } from '../../src/modulos/usuarios/consentimientos.repositorio';
import { ConsentimientosServicio } from '../../src/modulos/usuarios/consentimientos.servicio';

/** Identificadores de 02_datos_prueba.sql, para que las pruebas hablen el mismo idioma que la base. */
export const IDS = {
  trazado: '00000000-0000-4000-8000-000000000100',
  sentidoIda: '00000000-0000-4000-8000-000000000101',
  sentidoVuelta: '00000000-0000-4000-8000-000000000102',
  representante: '00000000-0000-4000-8000-000000000002',
  conductor1: '00000000-0000-4000-8000-000000000011',
  pasajero1: '00000000-0000-4000-8000-000000000021',
  vehiculo1: '00000000-0000-4000-8000-000000000201',
  jornadaAbierta: '00000000-0000-4000-8000-000000000302',
  otroTrazado: '00000000-0000-4000-8000-000000000999',
};

/** Recorrido de ida con la distancia acumulada que calcula 02_datos_prueba.sql. */
export const IDA_9001: PuntoRuta[] = [
  { orden: 1, latitud: -33.6105, longitud: -70.5757, distancia_acumulada_m: 0 },
  { orden: 2, latitud: -33.6062, longitud: -70.5764, distancia_acumulada_m: 483 },
  { orden: 3, latitud: -33.6018, longitud: -70.5772, distancia_acumulada_m: 977 },
  { orden: 4, latitud: -33.5975, longitud: -70.5781, distancia_acumulada_m: 1463 },
  { orden: 5, latitud: -33.5931, longitud: -70.579, distancia_acumulada_m: 1959 },
  { orden: 6, latitud: -33.5886, longitud: -70.5799, distancia_acumulada_m: 2466 },
  { orden: 7, latitud: -33.5842, longitud: -70.5807, distancia_acumulada_m: 2961 },
  { orden: 8, latitud: -33.5798, longitud: -70.5814, distancia_acumulada_m: 3455 },
  { orden: 9, latitud: -33.5772, longitud: -70.5818, distancia_acumulada_m: 3746 },
];

export const SENTIDO_IDA = {
  id: IDS.sentidoIda,
  trazado_id: IDS.trazado,
  sentido: 'ida' as const,
  origen: 'Plaza Puente Alto',
  destino: 'Hospital Sotero del Rio',
};

/** Un auditor falso que solo anota los eventos, para verificar que se registran. */
export function crearAuditoriaFalsa() {
  const eventos: { tipo: string; detalle?: Record<string, unknown> }[] = [];
  return {
    eventos,
    registrar: (e: { tipo: string; detalle?: Record<string, unknown> }) => {
      eventos.push(e);
      return Promise.resolve();
    },
  };
}

/**
 * El servicio de consentimientos REAL, con un repositorio falso: asi la
 * prueba ejercita la regla verdadera (403 sin consentimiento).
 */
export function crearConsentimientos(estado: { acepto: boolean }) {
  return new ConsentimientosServicio({
    tieneGeolocalizacionVigente: () => Promise.resolve(estado.acepto),
  } as unknown as ConsentimientosRepositorio);
}
