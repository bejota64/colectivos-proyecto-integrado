import {
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { UsuarioActual } from '../../comun/decoradores/usuario-actual.decorador';
import type { UsuarioSesion } from '../../comun/tipos';
import { ConsentimientosRepositorio } from './consentimientos.repositorio';
import { UsuariosRepositorio } from './usuarios.repositorio';

@Controller('usuarios')
export class UsuariosControlador {
  constructor(
    private readonly usuarios: UsuariosRepositorio,
    private readonly consentimientos: ConsentimientosRepositorio,
  ) {}

  /** Perfil propio. Sin @Roles: basta con tener sesion, cualquiera sea el rol. */
  @Get('yo')
  async verPerfilPropio(@UsuarioActual() sesion: UsuarioSesion) {
    const usuario = await this.usuarios.buscarPorId(sesion.id);
    if (!usuario) {
      throw new NotFoundException();
    }
    // Objeto de salida explicito: el hash de la contrasena nunca sale de la API.
    return {
      id: usuario.id,
      nombre_completo: usuario.nombre_completo,
      correo_electronico: usuario.correo_electronico,
      rol: usuario.rol,
    };
  }

  /** Acepta el uso de la ubicacion. La ruta siempre actua sobre la cuenta propia: no recibe ids. */
  @Post('yo/consentimientos/geolocalizacion')
  async aceptarGeolocalizacion(@UsuarioActual() sesion: UsuarioSesion) {
    await this.consentimientos.aceptarGeolocalizacion(sesion.id);
    return { geolocalizacion: 'aceptada' };
  }

  /** Revocar es tan facil como aceptar (Ley 21.719). */
  @Delete('yo/consentimientos/geolocalizacion')
  @HttpCode(204)
  async revocarGeolocalizacion(
    @UsuarioActual() sesion: UsuarioSesion,
  ): Promise<void> {
    if (!(await this.consentimientos.revocarGeolocalizacion(sesion.id))) {
      throw new NotFoundException('No tienes un consentimiento vigente');
    }
  }
}
