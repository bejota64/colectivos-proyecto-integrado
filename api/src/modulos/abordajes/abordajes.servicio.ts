import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { type Coordenada, desdeGeoJson, distanciaMetros } from '../../comun/geo';
import { JornadasRepositorio } from '../jornadas/jornadas.repositorio';
import { UbicacionesRepositorio } from '../jornadas/ubicaciones.repositorio';
import { ConsentimientosServicio } from '../usuarios/consentimientos.servicio';
import {
  AbordajeCreadoFila,
  AbordajesRepositorio,
} from './abordajes.repositorio';
import { AvisosRepositorio } from './avisos.repositorio';
import {
  MAXIMO_ABORDAJES_POR_DIA,
  motivoParaRechazarAbordaje,
} from './reglas-abordaje';

/**
 * "Me subi" (diagrama de actividad del diseno). Es un sistema critico:
 * habilita calificar y reportar, asi que un abordaje falso permitiria
 * danar la reputacion de un conductor con calificaciones inventadas.
 */
@Injectable()
export class AbordajesServicio {
  private readonly log = new Logger(AbordajesServicio.name);

  constructor(
    private readonly abordajes: AbordajesRepositorio,
    private readonly jornadas: JornadasRepositorio,
    private readonly ubicaciones: UbicacionesRepositorio,
    private readonly avisos: AvisosRepositorio,
    private readonly consentimientos: ConsentimientosServicio,
  ) {}

  async registrar(
    pasajeroId: string,
    datos: { jornadaId: string; coordenada: Coordenada },
    ahora: Date = new Date(),
  ): Promise<AbordajeCreadoFila> {
    await this.consentimientos.exigirGeolocalizacion(pasajeroId);

    const jornada = await this.jornadas.buscarAbierta(datos.jornadaId);
    if (!jornada || !jornada.sentido_actual_id) {
      throw new NotFoundException('Colectivo no disponible');
    }

    const ultima = await this.ubicaciones.ultima(jornada.id);
    // La ubicacion del pasajero se usa para medir y se descarta: en la base
    // queda solo la distancia, como evidencia ante una queja.
    const distancia = ultima
      ? distanciaMetros(datos.coordenada, desdeGeoJson(ultima.ubicacion))
      : null;
    const motivo = motivoParaRechazarAbordaje({
      distanciaM: distancia,
      edadPosicionS: ultima
        ? (ahora.getTime() - ultima.registrada_en.getTime()) / 1000
        : null,
      abordajesHoy: await this.abordajes.contarDeHoy(pasajeroId),
    });
    if (motivo || distancia === null) {
      throw new UnprocessableEntityException(motivo);
    }

    const abordaje = await this.abordajes.registrar({
      pasajeroId,
      jornadaId: jornada.id,
      distanciaM: Math.round(distancia),
      maximoPorDia: MAXIMO_ABORDAJES_POR_DIA,
    });
    if (!abordaje) {
      // La jornada se cerro, o llego otro "me subi" al mismo tiempo, entre la validacion y el INSERT.
      throw new ConflictException(
        'No se pudo registrar el viaje. Intenta de nuevo',
      );
    }

    // Si estaba esperando, su aviso termina. Si esto falla, el viaje ya
    // quedo registrado: no se le devuelve un error al pasajero por eso.
    try {
      await this.avisos.terminar(pasajeroId, ahora);
    } catch (error) {
      this.log.warn(
        `No se pudo terminar el aviso tras el abordaje: ${(error as Error).message}`,
      );
    }
    return abordaje;
  }

  listarPropios(pasajeroId: string) {
    return this.abordajes.listarDePasajero(pasajeroId);
  }
}
