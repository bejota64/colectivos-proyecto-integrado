import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaServicio } from '../auditoria/auditoria.servicio';
import { TrazadosRepositorio } from '../trazados/trazados.repositorio';
import { EstadisticasRepositorio } from './estadisticas.repositorio';

/**
 * Rol + pertenencia: tener el rol "representante" no basta, el trazado
 * tiene que ser suyo. Un trazado ajeno responde 404 (no se confirma que
 * exista) y el intento queda en la auditoria.
 */
@Injectable()
export class EstadisticasServicio {
  constructor(
    private readonly estadisticas: EstadisticasRepositorio,
    private readonly trazados: TrazadosRepositorio,
    private readonly auditoria: AuditoriaServicio,
  ) {}

  private async exigirPropio(
    trazadoId: string,
    representanteId: string,
    ip?: string,
  ): Promise<void> {
    if (!(await this.trazados.esDeRepresentante(trazadoId, representanteId))) {
      await this.auditoria.registrar({
        tipo: 'acceso_denegado',
        usuarioId: representanteId,
        ip,
        detalle: { accion: 'ver_estadisticas', trazado_id: trazadoId },
      });
      throw new NotFoundException('Trazado no encontrado');
    }
  }

  async demanda(
    trazadoId: string,
    representanteId: string,
    fecha: string | null,
    ip?: string,
  ) {
    await this.exigirPropio(trazadoId, representanteId, ip);
    return this.estadisticas.demandaDelDia(trazadoId, fecha);
  }

  async conductores(trazadoId: string, representanteId: string, ip?: string) {
    await this.exigirPropio(trazadoId, representanteId, ip);
    return this.estadisticas.resumenConductores(trazadoId);
  }
}
