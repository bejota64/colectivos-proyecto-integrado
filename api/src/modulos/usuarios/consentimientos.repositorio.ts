import { Injectable } from '@nestjs/common';
import { BaseDatosServicio } from '../../comun/base-datos/base-datos.servicio';

/** Version vigente de la politica que la persona acepta. */
export const VERSION_POLITICA_GEOLOCALIZACION = '1.0';

/**
 * Consentimiento de geolocalizacion (Ley 19.628 y Ley 21.719). Se pide la
 * primera vez que la persona usa una funcion que envia su ubicacion, no en
 * el registro, y se puede revocar en cualquier momento.
 */
@Injectable()
export class ConsentimientosRepositorio {
  constructor(private readonly baseDatos: BaseDatosServicio) {}

  /** Acepta, o vuelve a aceptar si lo habia revocado. */
  async aceptarGeolocalizacion(usuarioId: string): Promise<void> {
    await this.baseDatos.consultar(
      `INSERT INTO consentimientos (usuario_id, tipo, version_politica)
       VALUES ($1, 'geolocalizacion', $2)
       ON CONFLICT (usuario_id, tipo, version_politica)
       DO UPDATE SET aceptado_en = now(), revocado_en = NULL`,
      [usuarioId, VERSION_POLITICA_GEOLOCALIZACION],
    );
  }

  /** Devuelve false si no habia un consentimiento vigente que revocar. */
  async revocarGeolocalizacion(usuarioId: string): Promise<boolean> {
    const filas = await this.baseDatos.consultar<{ usuario_id: string }>(
      `UPDATE consentimientos SET revocado_en = now()
       WHERE usuario_id = $1 AND tipo = 'geolocalizacion' AND revocado_en IS NULL
       RETURNING usuario_id`,
      [usuarioId],
    );
    return filas.length > 0;
  }

  async tieneGeolocalizacionVigente(usuarioId: string): Promise<boolean> {
    const filas = await this.baseDatos.consultar<{ vigente: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM consentimientos
         WHERE usuario_id = $1 AND tipo = 'geolocalizacion' AND revocado_en IS NULL
       ) AS vigente`,
      [usuarioId],
    );
    return filas[0]?.vigente === true;
  }
}
