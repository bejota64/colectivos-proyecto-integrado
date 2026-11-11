import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
} from '@nestjs/common';
import { Roles } from '../../comun/decoradores/roles.decorador';
import { UsuarioActual } from '../../comun/decoradores/usuario-actual.decorador';
import type { UsuarioSesion } from '../../comun/tipos';
import { AbordajesServicio } from './abordajes.servicio';
import { AvisosServicio } from './avisos.servicio';
import { AbordajeDto, AvisoEsperaDto } from './dto/abordajes.dto';

@Controller('avisos-espera')
export class AvisosControlador {
  constructor(private readonly avisos: AvisosServicio) {}

  @Roles('pasajero')
  @Post()
  avisar(
    @UsuarioActual() sesion: UsuarioSesion,
    @Body() datos: AvisoEsperaDto,
  ) {
    return this.avisos.avisar(sesion.id, {
      sentidoId: datos.sentido_id,
      coordenada: { latitud: datos.latitud, longitud: datos.longitud },
      personas: datos.personas,
    });
  }

  /** "actual": el pasajero solo tiene un aviso y solo puede cancelar el suyo. */
  @Roles('pasajero')
  @Delete('actual')
  @HttpCode(204)
  async cancelar(@UsuarioActual() sesion: UsuarioSesion): Promise<void> {
    await this.avisos.cancelar(sesion.id);
  }

  @Roles('conductor')
  @Get('adelante')
  listarAdelante(@UsuarioActual() sesion: UsuarioSesion) {
    return this.avisos.listarAdelante(sesion.id);
  }
}

@Roles('pasajero')
@Controller('abordajes')
export class AbordajesControlador {
  constructor(private readonly abordajes: AbordajesServicio) {}

  @Post()
  registrar(
    @UsuarioActual() sesion: UsuarioSesion,
    @Body() datos: AbordajeDto,
  ) {
    return this.abordajes.registrar(sesion.id, {
      jornadaId: datos.jornada_id,
      coordenada: { latitud: datos.latitud, longitud: datos.longitud },
    });
  }

  @Get('mios')
  listarPropios(@UsuarioActual() sesion: UsuarioSesion) {
    return this.abordajes.listarPropios(sesion.id);
  }
}
