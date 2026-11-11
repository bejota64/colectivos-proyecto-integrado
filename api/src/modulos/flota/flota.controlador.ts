import { Controller, ForbiddenException, Get } from '@nestjs/common';
import { Roles } from '../../comun/decoradores/roles.decorador';
import { UsuarioActual } from '../../comun/decoradores/usuario-actual.decorador';
import type { UsuarioSesion } from '../../comun/tipos';
import { FlotaRepositorio } from './flota.repositorio';

@Controller('flota')
export class FlotaControlador {
  constructor(private readonly flota: FlotaRepositorio) {}

  /**
   * Autos libres para abrir jornada. El trazado sale del registro del
   * conductor, no de un parametro: no puede pedir la flota de otro trazado.
   */
  @Roles('conductor')
  @Get('vehiculos-disponibles')
  async listarDisponibles(@UsuarioActual() sesion: UsuarioSesion) {
    const conductor = await this.flota.buscarConductor(sesion.id);
    if (!conductor || !conductor.habilitado) {
      throw new ForbiddenException('Conductor no habilitado');
    }
    return this.flota.listarDisponibles(conductor.trazado_id);
  }
}
