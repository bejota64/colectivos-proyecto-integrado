import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { aGeoJson, type Coordenada, numeroTramo } from '../../comun/geo';
import { JornadasServicio } from '../jornadas/jornadas.servicio';
import { UbicacionesRepositorio } from '../jornadas/ubicaciones.repositorio';
import {
  MAXIMO_DISTANCIA_AL_RECORRIDO_M,
  RutasServicio,
} from '../trazados/rutas.servicio';
import { TrazadosRepositorio } from '../trazados/trazados.repositorio';
import { ConsentimientosServicio } from '../usuarios/consentimientos.servicio';
import { AvisosRepositorio } from './avisos.repositorio';
import { DemandaRepositorio } from './demanda.repositorio';
import { DURACION_AVISO_MS } from './reglas-abordaje';

export interface ResultadoAviso {
  numero_tramo: number;
  personas: number;
  expira_en: Date;
  /** true si se reactivo un aviso de los ultimos 20 min (no suma demanda otra vez). */
  reactivado: boolean;
}

@Injectable()
export class AvisosServicio {
  constructor(
    private readonly avisos: AvisosRepositorio,
    private readonly demanda: DemandaRepositorio,
    private readonly rutas: RutasServicio,
    private readonly trazados: TrazadosRepositorio,
    private readonly consentimientos: ConsentimientosServicio,
    private readonly jornadas: JornadasServicio,
    private readonly ubicaciones: UbicacionesRepositorio,
  ) {}

  /**
   * "Estoy esperando". Escribe en las DOS bases en la misma peticion
   * (LEEME, regla 7): el aviso en MongoDB y el contador en PostgreSQL.
   * No hay transaccion entre dos motores distintos, por eso si falla
   * PostgreSQL se deshace el aviso a mano (compensacion) y no quedan
   * datos a medias.
   */
  async avisar(
    pasajeroId: string,
    datos: { sentidoId: string; coordenada: Coordenada; personas: number },
    ahora: Date = new Date(),
  ): Promise<ResultadoAviso> {
    await this.consentimientos.exigirGeolocalizacion(pasajeroId);
    if (!(await this.trazados.buscarSentido(datos.sentidoId))) {
      throw new NotFoundException('Sentido no encontrado');
    }

    const proyeccion = await this.rutas.proyectar(
      datos.sentidoId,
      datos.coordenada,
    );
    if (
      !proyeccion ||
      proyeccion.distanciaAlRecorridoM > MAXIMO_DISTANCIA_AL_RECORRIDO_M
    ) {
      throw new UnprocessableEntityException(
        'Debes estar sobre el recorrido para avisar que esperas',
      );
    }
    const tramo = numeroTramo(proyeccion.distanciaRutaM);
    const cambios = {
      sentido_id: datos.sentidoId,
      ubicacion: aGeoJson(datos.coordenada),
      distancia_ruta_m: proyeccion.distanciaRutaM,
      personas: datos.personas,
    };

    const existente = await this.avisos.buscar(pasajeroId);
    if (existente && existente.expira_en.getTime() > ahora.getTime()) {
      await this.avisos.reactivar(pasajeroId, cambios);
      return {
        numero_tramo: tramo,
        personas: datos.personas,
        expira_en: existente.expira_en,
        reactivado: true,
      };
    }
    if (existente) {
      // Vencido pero aun no borrado por MongoDB (el TTL corre cada ~60 s).
      await this.avisos.eliminar(pasajeroId);
    }

    const expiraEn = new Date(ahora.getTime() + DURACION_AVISO_MS);
    const creado = await this.avisos.crear({
      pasajero_id: pasajeroId,
      ...cambios,
      creado_en: ahora,
      expira_en: expiraEn,
      terminado_en: null,
    });
    if (!creado) {
      throw new ConflictException('Ya tienes un aviso activo');
    }

    try {
      await this.demanda.sumarAviso({
        sentidoId: datos.sentidoId,
        numeroTramo: tramo,
        personas: datos.personas,
      });
    } catch (error) {
      await this.avisos.eliminar(pasajeroId);
      throw error;
    }

    return {
      numero_tramo: tramo,
      personas: datos.personas,
      expira_en: expiraEn,
      reactivado: false,
    };
  }

  async cancelar(pasajeroId: string, ahora: Date = new Date()): Promise<void> {
    if (!(await this.avisos.terminar(pasajeroId, ahora))) {
      throw new NotFoundException('No tienes un aviso activo');
    }
  }

  /** Para el conductor: cuanta gente espera mas adelante en su sentido. */
  async listarAdelante(conductorId: string, ahora: Date = new Date()) {
    const jornada = await this.jornadas.exigirAbierta(conductorId);
    if (!jornada.sentido_actual_id) {
      return [];
    }
    const ultima = await this.ubicaciones.ultima(jornada.id);
    const desde = ultima?.distancia_ruta_m ?? 0;
    const avisos = await this.avisos.listarAdelante(
      jornada.sentido_actual_id,
      desde,
      ahora,
    );
    return avisos.map((a) => ({
      metros_adelante: a.distancia_ruta_m - desde,
      numero_tramo: numeroTramo(a.distancia_ruta_m),
      personas: a.personas,
    }));
  }
}
