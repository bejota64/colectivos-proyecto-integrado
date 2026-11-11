import { Injectable } from '@nestjs/common';
import { BaseDatosServicio } from '../../comun/base-datos/base-datos.servicio';
import { Rol } from '../../comun/tipos';

export interface UsuarioFila {
  id: string;
  nombre_completo: string;
  correo_electronico: string;
  contrasena_hash: string;
  rol: Rol;
  activo: boolean;
}

const COLUMNAS =
  'id, nombre_completo, correo_electronico, contrasena_hash, rol, activo';

/** Codigo de PostgreSQL para "valor duplicado en una columna unica". */
const VIOLACION_DE_UNICIDAD = '23505';

@Injectable()
export class UsuariosRepositorio {
  constructor(private readonly baseDatos: BaseDatosServicio) {}

  async buscarPorCorreo(correo: string): Promise<UsuarioFila | null> {
    const filas = await this.baseDatos.consultar<UsuarioFila>(
      `SELECT ${COLUMNAS} FROM usuarios WHERE correo_electronico = $1 AND eliminado_en IS NULL`,
      [correo],
    );
    return filas[0] ?? null;
  }

  async buscarPorId(id: string): Promise<UsuarioFila | null> {
    const filas = await this.baseDatos.consultar<UsuarioFila>(
      `SELECT ${COLUMNAS} FROM usuarios WHERE id = $1 AND eliminado_en IS NULL`,
      [id],
    );
    return filas[0] ?? null;
  }

  /**
   * Crea un pasajero y registra su consentimiento en UNA sola sentencia:
   * o se guardan ambas cosas o ninguna. Devuelve null si el correo ya existe.
   * El rol va escrito en el SQL: nunca viene del cliente.
   *
   * Aqui se registran solo los terminos y la politica de privacidad, que es
   * lo que la persona acepto en el formulario. El consentimiento de
   * geolocalizacion NO se agrega en el registro: se pide aparte, la primera
   * vez que la persona usa una funcion que envia su ubicacion.
   */
  async crearPasajero(datos: {
    nombreCompleto: string;
    correo: string;
    contrasenaHash: string;
    versionPolitica: string;
  }): Promise<UsuarioFila | null> {
    try {
      const filas = await this.baseDatos.consultar<UsuarioFila>(
        `WITH nuevo AS (
           INSERT INTO usuarios (nombre_completo, correo_electronico, contrasena_hash, rol)
           VALUES ($1, $2, $3, 'pasajero')
           RETURNING ${COLUMNAS}
         ), consentimiento AS (
           INSERT INTO consentimientos (usuario_id, tipo, version_politica)
           SELECT nuevo.id, tipo, $4
           FROM nuevo, unnest(ARRAY['terminos_de_uso', 'politica_de_privacidad']) AS tipo
         )
         SELECT ${COLUMNAS} FROM nuevo`,
        [
          datos.nombreCompleto,
          datos.correo,
          datos.contrasenaHash,
          datos.versionPolitica,
        ],
      );
      return filas[0] ?? null;
    } catch (error) {
      if ((error as { code?: string }).code === VIOLACION_DE_UNICIDAD) {
        return null;
      }
      throw error;
    }
  }
}
