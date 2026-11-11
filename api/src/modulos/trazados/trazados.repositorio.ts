import { Injectable } from '@nestjs/common';
import { BaseDatosServicio } from '../../comun/base-datos/base-datos.servicio';
import type { PuntoRuta } from '../../comun/geo';

export interface TrazadoFila {
  id: string;
  codigo: string;
  nombre: string;
  comuna: string;
}

export interface SentidoFila {
  id: string;
  trazado_id: string;
  sentido: 'ida' | 'vuelta';
  origen: string;
  destino: string;
}

@Injectable()
export class TrazadosRepositorio {
  constructor(private readonly baseDatos: BaseDatosServicio) {}

  /** Pertenencia: la consulta filtra por el representante, no confia en un id que mande el cliente. */
  listarDeRepresentante(representanteId: string): Promise<TrazadoFila[]> {
    return this.baseDatos.consultar<TrazadoFila>(
      `SELECT id, codigo, nombre, comuna
       FROM trazados
       WHERE representante_id = $1 AND activo
       ORDER BY codigo`,
      [representanteId],
    );
  }

  /** Trazados activos: es informacion publica del servicio, como el letrero del colectivo. */
  listarActivos(): Promise<TrazadoFila[]> {
    return this.baseDatos.consultar<TrazadoFila>(
      `SELECT id, codigo, nombre, comuna FROM trazados WHERE activo ORDER BY codigo`,
    );
  }

  listarSentidos(trazadoId: string): Promise<SentidoFila[]> {
    return this.baseDatos.consultar<SentidoFila>(
      `SELECT s.id, s.trazado_id, s.sentido, s.origen, s.destino
       FROM sentidos s
       JOIN trazados t ON t.id = s.trazado_id AND t.activo
       WHERE s.trazado_id = $1
       ORDER BY s.sentido`,
      [trazadoId],
    );
  }

  /** Sentido de un trazado activo. Devuelve null si no existe. */
  async buscarSentido(sentidoId: string): Promise<SentidoFila | null> {
    const filas = await this.baseDatos.consultar<SentidoFila>(
      `SELECT s.id, s.trazado_id, s.sentido, s.origen, s.destino
       FROM sentidos s
       JOIN trazados t ON t.id = s.trazado_id AND t.activo
       WHERE s.id = $1`,
      [sentidoId],
    );
    return filas[0] ?? null;
  }

  /**
   * Puntos ordenados del recorrido. numeric(9,6) llega desde pg como texto,
   * por eso se convierte a float8 en el SQL.
   */
  puntosRuta(sentidoId: string): Promise<PuntoRuta[]> {
    return this.baseDatos.consultar<PuntoRuta>(
      `SELECT orden, latitud::float8 AS latitud, longitud::float8 AS longitud,
              distancia_acumulada_m
       FROM puntos_ruta
       WHERE sentido_id = $1
       ORDER BY orden`,
      [sentidoId],
    );
  }

  /** Pertenencia del representante: true solo si el trazado es suyo. */
  async esDeRepresentante(
    trazadoId: string,
    representanteId: string,
  ): Promise<boolean> {
    const filas = await this.baseDatos.consultar<{ es_suyo: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM trazados WHERE id = $1 AND representante_id = $2
       ) AS es_suyo`,
      [trazadoId, representanteId],
    );
    return filas[0]?.es_suyo === true;
  }
}
