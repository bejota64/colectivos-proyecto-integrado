import { Injectable } from '@nestjs/common';
import { BaseDatosServicio } from '../../comun/base-datos/base-datos.servicio';

/** Inicio del dia de hoy en hora de Chile, como timestamptz. */
const INICIO_DE_HOY = `(date_trunc('day', now() AT TIME ZONE 'America/Santiago') AT TIME ZONE 'America/Santiago')`;

export interface AbordajeCreadoFila {
  id: string;
  abordado_en: Date;
  distancia_al_vehiculo_m: number;
}

export interface AbordajePropioFila {
  id: string;
  abordado_en: Date;
  patente: string;
  sentido: string;
  estrellas: number | null;
}

@Injectable()
export class AbordajesRepositorio {
  constructor(private readonly baseDatos: BaseDatosServicio) {}

  async contarDeHoy(pasajeroId: string): Promise<number> {
    const filas = await this.baseDatos.consultar<{ total: number }>(
      `SELECT count(*)::int AS total FROM abordajes
       WHERE pasajero_id = $1 AND abordado_en >= ${INICIO_DE_HOY}`,
      [pasajeroId],
    );
    return filas[0]?.total ?? 0;
  }

  /**
   * Registra el abordaje en UNA sentencia que vuelve a comprobar que la
   * jornada siga abierta y que no se pase el tope diario. Si entre la
   * validacion del servicio y este INSERT la jornada se cerro, no se
   * inserta nada (devuelve null). El sentido sale de la jornada, no del cliente.
   */
  async registrar(datos: {
    pasajeroId: string;
    jornadaId: string;
    distanciaM: number;
    maximoPorDia: number;
  }): Promise<AbordajeCreadoFila | null> {
    const filas = await this.baseDatos.consultar<AbordajeCreadoFila>(
      `INSERT INTO abordajes (pasajero_id, jornada_id, sentido_id, distancia_al_vehiculo_m)
       SELECT $1, j.id, j.sentido_actual_id, $3
       FROM jornadas j
       WHERE j.id = $2
         AND j.finalizada_en IS NULL
         AND j.sentido_actual_id IS NOT NULL
         AND (SELECT count(*) FROM abordajes a
              WHERE a.pasajero_id = $1 AND a.abordado_en >= ${INICIO_DE_HOY}) < $4
       RETURNING id, abordado_en, distancia_al_vehiculo_m`,
      [datos.pasajeroId, datos.jornadaId, datos.distanciaM, datos.maximoPorDia],
    );
    return filas[0] ?? null;
  }

  /** Viajes propios, para calificar. La consulta filtra por el pasajero de la sesion. */
  listarDePasajero(pasajeroId: string): Promise<AbordajePropioFila[]> {
    return this.baseDatos.consultar<AbordajePropioFila>(
      `SELECT a.id, a.abordado_en, v.patente, s.sentido, c.estrellas
       FROM abordajes a
       JOIN jornadas j  ON j.id = a.jornada_id
       JOIN vehiculos v ON v.id = j.vehiculo_id
       JOIN sentidos s  ON s.id = a.sentido_id
       LEFT JOIN calificaciones c ON c.abordaje_id = a.id
       WHERE a.pasajero_id = $1
       ORDER BY a.abordado_en DESC
       LIMIT 20`,
      [pasajeroId],
    );
  }
}
