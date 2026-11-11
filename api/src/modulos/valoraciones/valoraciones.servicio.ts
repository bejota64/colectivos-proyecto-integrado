import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  codigoDeError,
  VIOLACION_DE_UNICIDAD,
} from '../../comun/base-datos/errores-postgres';
import {
  CalificacionFila,
  ValoracionesRepositorio,
} from './valoraciones.repositorio';

/**
 * Calificacion de 1 a 5 estrellas. Solo califica quien viajo, una vez por
 * viaje. El conductor nunca ve quien lo califico: el representante solo
 * recibe promedios (modulo estadisticas).
 */
@Injectable()
export class ValoracionesServicio {
  constructor(private readonly valoraciones: ValoracionesRepositorio) {}

  async calificar(
    pasajeroId: string,
    abordajeId: string,
    estrellas: number,
  ): Promise<CalificacionFila> {
    let calificacion: CalificacionFila | null;
    try {
      calificacion = await this.valoraciones.calificar({
        abordajeId,
        pasajeroId,
        estrellas,
      });
    } catch (error) {
      if (codigoDeError(error) === VIOLACION_DE_UNICIDAD) {
        throw new ConflictException('Ya calificaste este viaje');
      }
      throw error;
    }
    if (!calificacion) {
      // 404 y no 403: no se confirma que exista un viaje de otra persona con ese id.
      throw new NotFoundException('Viaje no encontrado');
    }
    return calificacion;
  }
}
