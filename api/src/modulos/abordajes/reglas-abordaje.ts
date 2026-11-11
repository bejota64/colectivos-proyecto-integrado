/**
 * Reglas del "me subi" y del aviso de espera, como funciones puras.
 * Son la defensa principal contra calificaciones falsas: solo opina quien
 * de verdad viajo (OWASP A06:2025, diseno inseguro).
 */

import { VIGENCIA_POSICION_S } from '../jornadas/reglas-jornada';

/** El pasajero debe estar a 200 m o menos del colectivo (LEEME, regla 4). */
export const DISTANCIA_MAXIMA_ABORDAJE_M = 200;
/** Maximo de abordajes por pasajero al dia (LEEME, regla 9). */
export const MAXIMO_ABORDAJES_POR_DIA = 6;
/** El aviso "estoy esperando" caduca solo a los 20 minutos. */
export const DURACION_AVISO_MS = 20 * 60 * 1000;

export interface DatosAbordaje {
  /** null si el colectivo no tiene ninguna posicion registrada. */
  distanciaM: number | null;
  edadPosicionS: number | null;
  abordajesHoy: number;
}

export function motivoParaRechazarAbordaje(d: DatosAbordaje): string | null {
  if (d.abordajesHoy >= MAXIMO_ABORDAJES_POR_DIA) {
    return `Ya registraste ${MAXIMO_ABORDAJES_POR_DIA} viajes hoy`;
  }
  if (
    d.distanciaM === null ||
    d.edadPosicionS === null ||
    d.edadPosicionS > VIGENCIA_POSICION_S
  ) {
    return 'El colectivo no tiene una posicion reciente. Intenta en unos segundos';
  }
  if (d.distanciaM > DISTANCIA_MAXIMA_ABORDAJE_M) {
    return 'Estas muy lejos del colectivo para marcar que te subiste';
  }
  return null;
}
