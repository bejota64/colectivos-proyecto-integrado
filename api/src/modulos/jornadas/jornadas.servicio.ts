import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  codigoDeError,
  VIOLACION_DE_UNICIDAD,
} from '../../comun/base-datos/errores-postgres';
import { AuditoriaServicio } from '../auditoria/auditoria.servicio';
import { FlotaRepositorio } from '../flota/flota.repositorio';
import { TrazadosRepositorio } from '../trazados/trazados.repositorio';
import { ConsentimientosServicio } from '../usuarios/consentimientos.servicio';
import { JornadaFila, JornadasRepositorio } from './jornadas.repositorio';
import {
  motivoAsientosInvalidos,
  motivoParaNoCambiarAsientos,
} from './reglas-jornada';
import { UbicacionesRepositorio } from './ubicaciones.repositorio';

/** Regla 8 del LEEME: si no hay jornada abierta, la web vuelve a "abrir jornada". */
export const MENSAJE_JORNADA_CERRADA = 'Jornada cerrada';
const MENSAJE_NO_ENCONTRADO = 'Vehiculo o sentido no encontrado';

/**
 * Reglas de la jornada del conductor. El conductor nunca envia su propio
 * id ni el de la jornada: ambos salen de la sesion. Asi no puede operar la
 * jornada de otra persona aunque adivine un id.
 */
@Injectable()
export class JornadasServicio {
  constructor(
    private readonly jornadas: JornadasRepositorio,
    private readonly ubicaciones: UbicacionesRepositorio,
    private readonly flota: FlotaRepositorio,
    private readonly trazados: TrazadosRepositorio,
    private readonly consentimientos: ConsentimientosServicio,
    private readonly auditoria: AuditoriaServicio,
  ) {}

  /** Jornada abierta del conductor, o 409 "Jornada cerrada". */
  async exigirAbierta(conductorId: string): Promise<JornadaFila> {
    const jornada = await this.jornadas.buscarAbiertaDeConductor(conductorId);
    if (!jornada) {
      throw new ConflictException(MENSAJE_JORNADA_CERRADA);
    }
    return jornada;
  }

  async abrir(
    conductorId: string,
    datos: { vehiculoId: string; sentidoId: string },
    ip?: string,
  ): Promise<JornadaFila> {
    const conductor = await this.flota.buscarConductor(conductorId);
    if (!conductor || !conductor.habilitado) {
      throw new ForbiddenException('Conductor no habilitado');
    }
    // Abrir jornada implica enviar la posicion cada 5 s.
    await this.consentimientos.exigirGeolocalizacion(conductorId);

    // Pertenencia: vehiculo y sentido deben ser del trazado del conductor.
    // Si no lo son, se responde 404 como si no existieran (no se confirma
    // que existan en otro trazado) y el intento queda auditado.
    const vehiculo = await this.flota.buscarVehiculoDeTrazado(
      datos.vehiculoId,
      conductor.trazado_id,
    );
    const sentido = await this.trazados.buscarSentido(datos.sentidoId);
    if (!vehiculo || !sentido || sentido.trazado_id !== conductor.trazado_id) {
      await this.auditoria.registrar({
        tipo: 'acceso_denegado',
        usuarioId: conductorId,
        ip,
        detalle: {
          accion: 'abrir_jornada',
          vehiculo_id: datos.vehiculoId,
          sentido_id: datos.sentidoId,
        },
      });
      throw new NotFoundException(MENSAJE_NO_ENCONTRADO);
    }

    let jornadaId: string;
    try {
      jornadaId = await this.jornadas.abrir({
        conductorId,
        vehiculoId: vehiculo.id,
        sentidoId: sentido.id,
        asientos: vehiculo.capacidad,
      });
    } catch (error) {
      if (codigoDeError(error) === VIOLACION_DE_UNICIDAD) {
        throw new ConflictException(
          'Ya tienes una jornada abierta o el vehiculo esta en uso',
        );
      }
      throw error;
    }

    await this.auditoria.registrar({
      tipo: 'inicio_jornada',
      usuarioId: conductorId,
      ip,
      detalle: { jornada_id: jornadaId, patente: vehiculo.patente },
    });
    return this.exigirAbierta(conductorId);
  }

  async cambiarAsientos(
    conductorId: string,
    asientos: number,
    ahora: Date = new Date(),
  ): Promise<JornadaFila> {
    const jornada = await this.exigirAbierta(conductorId);

    const invalidos = motivoAsientosInvalidos(asientos, jornada.capacidad);
    if (invalidos) {
      throw new BadRequestException(invalidos);
    }

    const ultima = await this.ubicaciones.ultima(jornada.id);
    const enMovimiento = motivoParaNoCambiarAsientos(
      ultima
        ? {
            velocidadKmh: ultima.velocidad_kmh,
            edadSegundos:
              (ahora.getTime() - ultima.registrada_en.getTime()) / 1000,
          }
        : null,
    );
    if (enMovimiento) {
      throw new UnprocessableEntityException(enMovimiento);
    }

    if (!(await this.jornadas.actualizarAsientos(jornada.id, asientos))) {
      throw new ConflictException(MENSAJE_JORNADA_CERRADA);
    }
    return { ...jornada, asientos_disponibles: asientos };
  }

  /** En el terminal el conductor pasa de ida a vuelta (o al reves). */
  async cambiarSentido(conductorId: string, sentidoId: string): Promise<JornadaFila> {
    const jornada = await this.exigirAbierta(conductorId);
    const sentido = await this.trazados.buscarSentido(sentidoId);
    if (!sentido || sentido.trazado_id !== jornada.trazado_id) {
      throw new NotFoundException('Sentido no encontrado');
    }
    if (!(await this.jornadas.cambiarSentido(jornada.id, sentido.id))) {
      throw new ConflictException(MENSAJE_JORNADA_CERRADA);
    }
    return { ...jornada, sentido_actual_id: sentido.id };
  }

  async cerrar(conductorId: string, ip?: string): Promise<void> {
    const jornada = await this.exigirAbierta(conductorId);
    if (!(await this.jornadas.cerrar(jornada.id))) {
      throw new ConflictException(MENSAJE_JORNADA_CERRADA);
    }
    await this.auditoria.registrar({
      tipo: 'fin_jornada',
      usuarioId: conductorId,
      ip,
      detalle: { jornada_id: jornada.id, patente: jornada.patente },
    });
  }
}
