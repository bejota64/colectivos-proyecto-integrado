import { Injectable } from '@nestjs/common';
import { BaseDatosServicio } from '../../comun/base-datos/base-datos.servicio';

/**
 * Escritura de la demanda (la lectura esta en estadisticas). Es un contador
 * anonimo por tramo y hora: no guarda quien aviso (privacidad por diseno).
 */
@Injectable()
export class DemandaRepositorio {
  constructor(private readonly baseDatos: BaseDatosServicio) {}

  /** Fecha y hora se calculan en la base, en hora de Chile, igual para todos los avisos. */
  async sumarAviso(datos: {
    sentidoId: string;
    numeroTramo: number;
    personas: number;
  }): Promise<void> {
    await this.baseDatos.consultar(
      `INSERT INTO demanda_por_tramo (sentido_id, numero_tramo, fecha, hora, avisos, personas)
       VALUES ($1, $2,
               (now() AT TIME ZONE 'America/Santiago')::date,
               extract(hour FROM now() AT TIME ZONE 'America/Santiago')::smallint,
               1, $3)
       ON CONFLICT (sentido_id, numero_tramo, fecha, hora)
       DO UPDATE SET avisos   = demanda_por_tramo.avisos + 1,
                     personas = demanda_por_tramo.personas + EXCLUDED.personas`,
      [datos.sentidoId, datos.numeroTramo, datos.personas],
    );
  }
}
