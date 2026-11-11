import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Roles } from '../../comun/decoradores/roles.decorador';
import { UsuarioActual } from '../../comun/decoradores/usuario-actual.decorador';
import type { UsuarioSesion } from '../../comun/tipos';
import { CalificacionDto } from './dto/calificacion.dto';
import { ValoracionesServicio } from './valoraciones.servicio';

@Roles('pasajero')
@Controller('abordajes')
export class ValoracionesControlador {
  constructor(private readonly valoraciones: ValoracionesServicio) {}

  /** ParseUUIDPipe: un id que no es uuid responde 400 antes de llegar a la base. */
  @Post(':abordajeId/calificacion')
  calificar(
    @UsuarioActual() sesion: UsuarioSesion,
    @Param('abordajeId', new ParseUUIDPipe()) abordajeId: string,
    @Body() datos: CalificacionDto,
  ) {
    return this.valoraciones.calificar(sesion.id, abordajeId, datos.estrellas);
  }
}
