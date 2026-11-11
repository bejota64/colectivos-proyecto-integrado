import { Injectable } from '@nestjs/common';
import { BaseDatosServicio } from '../../comun/base-datos/base-datos.servicio';

export interface DemandaFila {
  sentido: string;
  numero_tramo: number;
  hora: number;
  avisos: number;
  personas: number;
}

export interface ResumenConductorFila {
  conductor: string;
  abordajes: number;
  nota_promedio: number | null;
  quejas: number;
  felicitaciones: number;
}

/** Lectura para el panel del representante. Todo agregado: ninguna fila identifica a un pasajero. */
@Injectable()
export class EstadisticasRepositorio {
  constructor(private readonly baseDatos: BaseDatosServicio) {}

  /** fecha null = hoy, en hora de Chile. */
  demandaDelDia(trazadoId: string, fecha: string | null): Promise<DemandaFila[]> {
    return this.baseDatos.consultar<DemandaFila>(
      `SELECT s.sentido, d.numero_tramo, d.hora, d.avisos, d.personas
       FROM demanda_por_tramo d
       JOIN sentidos s ON s.id = d.sentido_id
       WHERE s.trazado_id = $1
         AND d.fecha = coalesce($2::date, (now() AT TIME ZONE 'America/Santiago')::date)
       ORDER BY s.sentido, d.hora, d.numero_tramo`,
      [trazadoId, fecha],
    );
  }

  /** Consulta 6 de consultas_ejemplo.sql: comportamiento por conductor. */
  resumenConductores(trazadoId: string): Promise<ResumenConductorFila[]> {
    return this.baseDatos.consultar<ResumenConductorFila>(
      `SELECT u.nombre_completo AS conductor,
              count(DISTINCT a.id)::int AS abordajes,
              round(avg(c.estrellas), 1)::float8 AS nota_promedio,
              count(DISTINCT r.id) FILTER (WHERE r.tipo = 'queja')::int AS quejas,
              count(DISTINCT r.id) FILTER (WHERE r.tipo = 'felicitacion')::int AS felicitaciones
       FROM conductores co
       JOIN usuarios u        ON u.id = co.usuario_id
       LEFT JOIN jornadas j   ON j.conductor_id = co.usuario_id
       LEFT JOIN abordajes a  ON a.jornada_id = j.id
       LEFT JOIN calificaciones c ON c.abordaje_id = a.id
       LEFT JOIN reportes r   ON r.abordaje_id = a.id
       WHERE co.trazado_id = $1
       GROUP BY u.nombre_completo
       ORDER BY u.nombre_completo`,
      [trazadoId],
    );
  }
}
