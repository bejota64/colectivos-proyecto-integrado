import { Injectable } from '@nestjs/common';
import { BaseDatosServicio } from '../../comun/base-datos/base-datos.servicio';

/** Jornada abierta con los datos de su vehiculo que se usan en casi todas las reglas. */
export interface JornadaFila {
  id: string;
  conductor_id: string;
  vehiculo_id: string;
  sentido_actual_id: string | null;
  asientos_disponibles: number;
  iniciada_en: Date;
  trazado_id: string;
  patente: string;
  capacidad: number;
}

export interface ColectivoEnServicioFila {
  jornada_id: string;
  patente: string;
  vehiculo: string;
  asientos_disponibles: number;
  nota_promedio: number | null;
}

const SELECCION_ABIERTA = `
  SELECT j.id, j.conductor_id, j.vehiculo_id, j.sentido_actual_id,
         j.asientos_disponibles, j.iniciada_en,
         v.trazado_id, v.patente, v.capacidad
  FROM jornadas j
  JOIN vehiculos v ON v.id = j.vehiculo_id
  WHERE j.finalizada_en IS NULL`;

@Injectable()
export class JornadasRepositorio {
  constructor(private readonly baseDatos: BaseDatosServicio) {}

  /**
   * Abre la jornada. Si el conductor o el vehiculo ya tienen una abierta,
   * PostgreSQL lanza el error 23505 por los indices unicos parciales del
   * esquema: la base es la ultima defensa aunque dos peticiones lleguen juntas.
   */
  async abrir(datos: {
    conductorId: string;
    vehiculoId: string;
    sentidoId: string;
    asientos: number;
  }): Promise<string> {
    const filas = await this.baseDatos.consultar<{ id: string }>(
      `INSERT INTO jornadas (conductor_id, vehiculo_id, sentido_actual_id, asientos_disponibles)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [datos.conductorId, datos.vehiculoId, datos.sentidoId, datos.asientos],
    );
    return filas[0].id;
  }

  async buscarAbiertaDeConductor(conductorId: string): Promise<JornadaFila | null> {
    const filas = await this.baseDatos.consultar<JornadaFila>(
      `${SELECCION_ABIERTA} AND j.conductor_id = $1`,
      [conductorId],
    );
    return filas[0] ?? null;
  }

  async buscarAbierta(jornadaId: string): Promise<JornadaFila | null> {
    const filas = await this.baseDatos.consultar<JornadaFila>(
      `${SELECCION_ABIERTA} AND j.id = $1`,
      [jornadaId],
    );
    return filas[0] ?? null;
  }

  /**
   * Colectivos en servicio en un sentido, con la nota promedio de su
   * conductor (historica). No incluye el nombre del conductor: el
   * pasajero no lo necesita para decidir (minimizacion de datos).
   */
  listarAbiertasDeSentido(sentidoId: string): Promise<ColectivoEnServicioFila[]> {
    return this.baseDatos.consultar<ColectivoEnServicioFila>(
      `SELECT j.id AS jornada_id, v.patente, v.marca || ' ' || v.modelo AS vehiculo,
              j.asientos_disponibles,
              (SELECT round(avg(c.estrellas), 1)::float8
               FROM jornadas jh
               JOIN abordajes a ON a.jornada_id = jh.id
               JOIN calificaciones c ON c.abordaje_id = a.id
               WHERE jh.conductor_id = j.conductor_id) AS nota_promedio
       FROM jornadas j
       JOIN vehiculos v ON v.id = j.vehiculo_id
       WHERE j.finalizada_en IS NULL AND j.sentido_actual_id = $1
       ORDER BY v.patente`,
      [sentidoId],
    );
  }

  /** Las condiciones van en el UPDATE: si la jornada se cerro entre medio, no cambia nada. */
  async actualizarAsientos(jornadaId: string, asientos: number): Promise<boolean> {
    const filas = await this.baseDatos.consultar<{ id: string }>(
      `UPDATE jornadas SET asientos_disponibles = $2
       WHERE id = $1 AND finalizada_en IS NULL
       RETURNING id`,
      [jornadaId, asientos],
    );
    return filas.length === 1;
  }

  async cambiarSentido(jornadaId: string, sentidoId: string): Promise<boolean> {
    const filas = await this.baseDatos.consultar<{ id: string }>(
      `UPDATE jornadas SET sentido_actual_id = $2
       WHERE id = $1 AND finalizada_en IS NULL
       RETURNING id`,
      [jornadaId, sentidoId],
    );
    return filas.length === 1;
  }

  async cerrar(jornadaId: string): Promise<boolean> {
    const filas = await this.baseDatos.consultar<{ id: string }>(
      `UPDATE jornadas SET finalizada_en = now()
       WHERE id = $1 AND finalizada_en IS NULL
       RETURNING id`,
      [jornadaId],
    );
    return filas.length === 1;
  }
}
