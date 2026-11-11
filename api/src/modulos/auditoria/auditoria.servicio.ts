import { Injectable, Logger } from '@nestjs/common';
import { MongoServicio } from '../../comun/mongo/mongo.servicio';

/** Tipos permitidos por el validador de registro_eventos (01_colecciones.js). */
export type TipoEvento =
  | 'inicio_sesion_exitoso'
  | 'inicio_sesion_fallido'
  | 'cierre_sesion'
  | 'acceso_denegado'
  | 'inicio_jornada'
  | 'fin_jornada';

export interface Evento {
  tipo: TipoEvento;
  usuarioId?: string | null;
  ip?: string;
  /** Nunca poner aqui contrasenas, tokens ni ubicaciones de pasajeros. */
  detalle?: Record<string, unknown>;
}

/**
 * Registro de auditoria: quien hizo que y cuando. Es la evidencia que se
 * entrega si hay que investigar un acceso ilicito (Ley 21.459).
 *
 * Si MongoDB falla, el evento se pierde pero la peticion del usuario NO
 * falla: la auditoria acompana la operacion, no la bloquea. El fallo queda
 * en el log del servidor para revisarlo.
 */
@Injectable()
export class AuditoriaServicio {
  private readonly log = new Logger(AuditoriaServicio.name);

  constructor(private readonly mongo: MongoServicio) {}

  async registrar(evento: Evento): Promise<void> {
    try {
      await this.mongo.coleccion('registro_eventos').insertOne({
        tipo: evento.tipo,
        usuario_id: evento.usuarioId ?? null,
        direccion_ip: evento.ip,
        detalle: evento.detalle,
        ocurrido_en: new Date(),
      });
    } catch (error) {
      this.log.warn(
        `No se pudo registrar el evento ${evento.tipo}: ${(error as Error).message}`,
      );
    }
  }
}
