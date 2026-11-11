import {
  Body,
  Controller,
  Get,
  HttpCode,
  Ip,
  Patch,
  Post,
} from '@nestjs/common';
import { Roles } from '../../comun/decoradores/roles.decorador';
import { UsuarioActual } from '../../comun/decoradores/usuario-actual.decorador';
import type { UsuarioSesion } from '../../comun/tipos';
import {
  AbrirJornadaDto,
  CambiarAsientosDto,
  CambiarSentidoDto,
} from './dto/jornadas.dto';
import type { JornadaFila } from './jornadas.repositorio';
import { JornadasServicio } from './jornadas.servicio';

/** Salida explicita: solo lo que la pantalla del conductor necesita. */
function aRespuesta(j: JornadaFila) {
  return {
    id: j.id,
    patente: j.patente,
    sentido_id: j.sentido_actual_id,
    asientos_disponibles: j.asientos_disponibles,
    capacidad: j.capacidad,
    iniciada_en: j.iniciada_en,
  };
}

/** @Roles en la clase: TODAS las rutas de este controlador son solo para conductores. */
@Roles('conductor')
@Controller('jornadas')
export class JornadasControlador {
  constructor(private readonly jornadas: JornadasServicio) {}

  @Get('actual')
  async verActual(@UsuarioActual() sesion: UsuarioSesion) {
    return aRespuesta(await this.jornadas.exigirAbierta(sesion.id));
  }

  @Post()
  async abrir(
    @UsuarioActual() sesion: UsuarioSesion,
    @Body() datos: AbrirJornadaDto,
    @Ip() ip: string,
  ) {
    const jornada = await this.jornadas.abrir(
      sesion.id,
      { vehiculoId: datos.vehiculo_id, sentidoId: datos.sentido_id },
      ip,
    );
    return aRespuesta(jornada);
  }

  @Patch('actual/asientos')
  async cambiarAsientos(
    @UsuarioActual() sesion: UsuarioSesion,
    @Body() datos: CambiarAsientosDto,
  ) {
    return aRespuesta(
      await this.jornadas.cambiarAsientos(sesion.id, datos.asientos_disponibles),
    );
  }

  @Patch('actual/sentido')
  async cambiarSentido(
    @UsuarioActual() sesion: UsuarioSesion,
    @Body() datos: CambiarSentidoDto,
  ) {
    return aRespuesta(
      await this.jornadas.cambiarSentido(sesion.id, datos.sentido_id),
    );
  }

  @Post('actual/cierre')
  @HttpCode(204)
  async cerrar(
    @UsuarioActual() sesion: UsuarioSesion,
    @Ip() ip: string,
  ): Promise<void> {
    await this.jornadas.cerrar(sesion.id, ip);
  }
}
