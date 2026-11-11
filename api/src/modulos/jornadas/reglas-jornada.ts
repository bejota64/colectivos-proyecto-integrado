/**
 * Reglas de la jornada como funciones puras: reciben datos y devuelven el
 * motivo del rechazo, o null si se acepta. No tocan bases ni HTTP, por eso
 * se prueban solas (reglas-jornada.spec.ts) y el servicio queda corto.
 */

import { type Coordenada, distanciaMetros } from '../../comun/geo';

/** Bajo esta velocidad se considera que el auto esta detenido. */
export const VELOCIDAD_DETENIDO_KMH = 5;
/** Una posicion GPS con mas de 60 s ya no sirve para decidir nada. */
export const VIGENCIA_POSICION_S = 60;
/** Tope del validador de MongoDB; sobre esto el dato es un error o una falsificacion. */
export const VELOCIDAD_MAXIMA_CREIBLE_KMH = 150;

export interface UltimaPosicion {
  velocidadKmh: number;
  edadSegundos: number;
}

/**
 * Asientos solo con el auto detenido (Ley 21.377, "Ley No Chat": el
 * conductor no puede manipular el celular en movimiento).
 *
 * La web tambien bloquea los botones, pero eso se puede saltar con
 * Postman: por eso la regla se aplica AQUI, en el servidor.
 */
export function motivoParaNoCambiarAsientos(
  ultima: UltimaPosicion | null,
): string | null {
  if (!ultima || ultima.edadSegundos > VIGENCIA_POSICION_S) {
    return 'Sin señal GPS reciente: no se puede confirmar que el auto este detenido';
  }
  if (ultima.velocidadKmh > VELOCIDAD_DETENIDO_KMH) {
    return 'Los asientos solo se ajustan con el auto detenido';
  }
  return null;
}

/** Regla 3 del LEEME: los asientos libres no superan la capacidad del vehiculo. */
export function motivoAsientosInvalidos(
  asientos: number,
  capacidad: number,
): string | null {
  if (!Number.isInteger(asientos) || asientos < 0 || asientos > capacidad) {
    return `Los asientos disponibles deben estar entre 0 y ${capacidad}`;
  }
  return null;
}

export interface Muestra {
  coordenada: Coordenada;
  en: Date;
}

/**
 * Velocidad calculada entre dos posiciones, en km/h. Devuelve null si
 * pasaron menos de 1 s (el calculo no seria confiable).
 */
export function velocidadEntre(anterior: Muestra, actual: Muestra): number | null {
  const segundos = (actual.en.getTime() - anterior.en.getTime()) / 1000;
  if (segundos < 1) {
    return null;
  }
  return (distanciaMetros(anterior.coordenada, actual.coordenada) / segundos) * 3.6;
}
