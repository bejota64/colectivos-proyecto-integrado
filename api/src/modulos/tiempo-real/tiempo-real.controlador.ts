import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../../comun/decoradores/roles.decorador';
import { UsuarioActual } from '../../comun/decoradores/usuario-actual.decorador';
import type { UsuarioSesion } from '../../comun/tipos';
import { ColectivosConsultaDto, PosicionDto } from './dto/tiempo-real.dto';
import { TiempoRealServicio } from './tiempo-real.servicio';

@Controller('tiempo-real')
export class TiempoRealControlador {
  constructor(private readonly tiempoReal: TiempoRealServicio) {}

  @Roles('conductor')
  @Post('posiciones')
  registrarPosicion(
    @UsuarioActual() sesion: UsuarioSesion,
    @Body() datos: PosicionDto,
  ) {
    return this.tiempoReal.registrarPosicion(sesion.id, {
      latitud: datos.latitud,
      longitud: datos.longitud,
      velocidadKmh: datos.velocidad_kmh,
    });
  }

  /**
   * La ubicacion del pasajero es opcional: sin ella ve el mapa, con ella
   * ademas ve en cuantos minutos llega cada colectivo. Esta ubicacion se
   * usa para calcular y NO se guarda, pero igual exige consentimiento.
   */
  @Roles('pasajero')
  @Get('colectivos')
  listarColectivos(
    @UsuarioActual() sesion: UsuarioSesion,
    @Query() consulta: ColectivosConsultaDto,
  ) {
    const { latitud, longitud } = consulta;
    if ((latitud === undefined) !== (longitud === undefined)) {
      throw new BadRequestException('Envia latitud y longitud juntas');
    }
    const pasajero =
      latitud !== undefined && longitud !== undefined
        ? { latitud, longitud }
        : null;
    return this.tiempoReal.listarColectivos(
      sesion.id,
      consulta.sentido_id,
      pasajero,
    );
  }
}
