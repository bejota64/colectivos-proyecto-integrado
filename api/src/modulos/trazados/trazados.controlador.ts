import { Controller, Get, NotFoundException, Param, ParseUUIDPipe } from '@nestjs/common';
import { Roles } from '../../comun/decoradores/roles.decorador';
import { UsuarioActual } from '../../comun/decoradores/usuario-actual.decorador';
import type { UsuarioSesion } from '../../comun/tipos';
import { RutasServicio } from './rutas.servicio';
import { TrazadosRepositorio } from './trazados.repositorio';

@Controller('trazados')
export class TrazadosControlador {
  constructor(
    private readonly trazados: TrazadosRepositorio,
    private readonly rutas: RutasServicio,
  ) {}

  /** Ejemplo de ruta por rol y por pertenencia: solo el representante, y solo sus trazados. */
  @Roles('representante')
  @Get('mios')
  listarMios(@UsuarioActual() sesion: UsuarioSesion) {
    return this.trazados.listarDeRepresentante(sesion.id);
  }

  /** Trazados activos con sus sentidos, para elegir donde esperar. Cualquier rol con sesion. */
  @Get()
  async listarActivos() {
    const trazados = await this.trazados.listarActivos();
    return Promise.all(
      trazados.map(async (trazado) => ({
        ...trazado,
        sentidos: await this.trazados.listarSentidos(trazado.id),
      })),
    );
  }

  /**
   * Linea del recorrido para dibujarla en el mapa. ParseUUIDPipe responde
   * 400 si el id no es un uuid, antes de tocar la base.
   */
  @Get('sentidos/:sentidoId/recorrido')
  async verRecorrido(
    @Param('sentidoId', new ParseUUIDPipe()) sentidoId: string,
  ) {
    if (!(await this.trazados.buscarSentido(sentidoId))) {
      throw new NotFoundException('Recorrido no encontrado');
    }
    const puntos = await this.rutas.puntos(sentidoId);
    return puntos.map((p) => ({
      orden: p.orden,
      latitud: p.latitud,
      longitud: p.longitud,
    }));
  }
}
