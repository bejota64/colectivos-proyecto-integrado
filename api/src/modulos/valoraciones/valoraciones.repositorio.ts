import { Injectable } from '@nestjs/common';
import { BaseDatosServicio } from '../../comun/base-datos/base-datos.servicio';

export interface CalificacionFila {
  abordaje_id: string;
  estrellas: number;
  creada_en: Date;
}

@Injectable()
export class ValoracionesRepositorio {
  constructor(private readonly baseDatos: BaseDatosServicio) {}

  /**
   * Califica SOLO si el abordaje es del pasajero de la sesion: la condicion
   * de pertenencia va dentro del INSERT. Si el abordaje es de otra persona,
   * o no existe, no se inserta nada y devuelve null (la API responde 404).
   * Si ya estaba calificado, PostgreSQL lanza 23505 (una por abordaje).
   */
  async calificar(datos: {
    abordajeId: string;
    pasajeroId: string;
    estrellas: number;
  }): Promise<CalificacionFila | null> {
    const filas = await this.baseDatos.consultar<CalificacionFila>(
      `INSERT INTO calificaciones (abordaje_id, estrellas)
       SELECT a.id, $3 FROM abordajes a
       WHERE a.id = $1 AND a.pasajero_id = $2
       RETURNING abordaje_id, estrellas, creada_en`,
      [datos.abordajeId, datos.pasajeroId, datos.estrellas],
    );
    return filas[0] ?? null;
  }
}
