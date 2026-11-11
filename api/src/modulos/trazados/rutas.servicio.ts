import { Injectable } from '@nestjs/common';
import {
  type Coordenada,
  type Proyeccion,
  type PuntoRuta,
  proyectarEnRuta,
} from '../../comun/geo';
import { TrazadosRepositorio } from './trazados.repositorio';

/** El recorrido cambia muy rara vez: se guarda en memoria por 5 minutos. */
const VIGENCIA_CACHE_MS = 5 * 60 * 1000;

/**
 * Maxima distancia a la linea del recorrido para aceptar una posicion o un
 * aviso. Valor propuesto por el equipo para el prototipo: confirmarlo con
 * el recorrido real de Don Hector (planilla E2).
 */
export const MAXIMO_DISTANCIA_AL_RECORRIDO_M = 200;

/**
 * Proyecta posiciones sobre el recorrido. Sin cache, cada envio de GPS
 * (uno cada 5 s por colectivo) leeria los mismos puntos de la base.
 */
@Injectable()
export class RutasServicio {
  private readonly cache = new Map<
    string,
    { puntos: PuntoRuta[]; leidoEn: number }
  >();

  constructor(private readonly trazados: TrazadosRepositorio) {}

  async puntos(sentidoId: string, ahora = Date.now()): Promise<PuntoRuta[]> {
    const guardado = this.cache.get(sentidoId);
    if (guardado && ahora - guardado.leidoEn < VIGENCIA_CACHE_MS) {
      return guardado.puntos;
    }
    const puntos = await this.trazados.puntosRuta(sentidoId);
    this.cache.set(sentidoId, { puntos, leidoEn: ahora });
    return puntos;
  }

  /** Devuelve null si el sentido no tiene recorrido cargado. */
  async proyectar(
    sentidoId: string,
    c: Coordenada,
  ): Promise<Proyeccion | null> {
    return proyectarEnRuta(await this.puntos(sentidoId), c);
  }
}
