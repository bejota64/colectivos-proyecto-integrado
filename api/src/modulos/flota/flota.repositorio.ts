import { Injectable } from '@nestjs/common';
import { BaseDatosServicio } from '../../comun/base-datos/base-datos.servicio';

export interface ConductorFila {
  usuario_id: string;
  trazado_id: string;
  habilitado: boolean;
}

export interface VehiculoFila {
  id: string;
  patente: string;
  marca: string;
  modelo: string;
  capacidad: number;
}

@Injectable()
export class FlotaRepositorio {
  constructor(private readonly baseDatos: BaseDatosServicio) {}

  async buscarConductor(usuarioId: string): Promise<ConductorFila | null> {
    const filas = await this.baseDatos.consultar<ConductorFila>(
      `SELECT usuario_id, trazado_id, habilitado FROM conductores WHERE usuario_id = $1`,
      [usuarioId],
    );
    return filas[0] ?? null;
  }

  /**
   * Vehiculo activo SOLO si es del trazado indicado (regla 2 del LEEME:
   * conductor y vehiculo deben ser del mismo trazado). Si es de otro
   * trazado devuelve null, igual que si no existiera.
   */
  async buscarVehiculoDeTrazado(
    vehiculoId: string,
    trazadoId: string,
  ): Promise<VehiculoFila | null> {
    const filas = await this.baseDatos.consultar<VehiculoFila>(
      `SELECT id, patente, marca, modelo, capacidad
       FROM vehiculos
       WHERE id = $1 AND trazado_id = $2 AND activo`,
      [vehiculoId, trazadoId],
    );
    return filas[0] ?? null;
  }

  /** Vehiculos del trazado que no estan en una jornada abierta. */
  listarDisponibles(trazadoId: string): Promise<VehiculoFila[]> {
    return this.baseDatos.consultar<VehiculoFila>(
      `SELECT v.id, v.patente, v.marca, v.modelo, v.capacidad
       FROM vehiculos v
       WHERE v.trazado_id = $1 AND v.activo
         AND NOT EXISTS (
           SELECT 1 FROM jornadas j
           WHERE j.vehiculo_id = v.id AND j.finalizada_en IS NULL)
       ORDER BY v.patente`,
      [trazadoId],
    );
  }
}
