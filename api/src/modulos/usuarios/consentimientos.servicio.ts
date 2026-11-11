import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConsentimientosRepositorio } from './consentimientos.repositorio';

export const MENSAJE_SIN_CONSENTIMIENTO =
  'Debes aceptar el uso de tu ubicacion antes de usar esta funcion';

@Injectable()
export class ConsentimientosServicio {
  constructor(private readonly consentimientos: ConsentimientosRepositorio) {}

  /**
   * Se llama antes de guardar o usar cualquier ubicacion. Sin consentimiento
   * vigente responde 403: tratar datos de ubicacion sin el, aunque el
   * sistema funcione, infringe la ley de proteccion de datos.
   */
  async exigirGeolocalizacion(usuarioId: string): Promise<void> {
    if (!(await this.consentimientos.tieneGeolocalizacionVigente(usuarioId))) {
      throw new ForbiddenException(MENSAJE_SIN_CONSENTIMIENTO);
    }
  }
}
