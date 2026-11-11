import { NotFoundException } from '@nestjs/common';
import { crearAuditoriaFalsa, IDS } from '../../../test/datos/recorrido-9001';
import type { AuditoriaServicio } from '../auditoria/auditoria.servicio';
import type { TrazadosRepositorio } from '../trazados/trazados.repositorio';
import type { EstadisticasRepositorio } from './estadisticas.repositorio';
import { EstadisticasServicio } from './estadisticas.servicio';

describe('EstadisticasServicio: rol + pertenencia', () => {
  let auditoria: ReturnType<typeof crearAuditoriaFalsa>;
  let consultas: number;
  let servicio: EstadisticasServicio;

  beforeEach(() => {
    auditoria = crearAuditoriaFalsa();
    consultas = 0;
    servicio = new EstadisticasServicio(
      {
        demandaDelDia: () => {
          consultas++;
          return Promise.resolve([{ sentido: 'ida', numero_tramo: 0, hora: 8, avisos: 9, personas: 12 }]);
        },
        resumenConductores: () => {
          consultas++;
          return Promise.resolve([]);
        },
      } as unknown as EstadisticasRepositorio,
      {
        esDeRepresentante: (trazadoId: string, representanteId: string) =>
          Promise.resolve(trazadoId === IDS.trazado && representanteId === IDS.representante),
      } as unknown as TrazadosRepositorio,
      auditoria as unknown as AuditoriaServicio,
    );
  });

  it('el representante ve la demanda de SU trazado', async () => {
    const filas = await servicio.demanda(IDS.trazado, IDS.representante, null);
    expect(filas).toHaveLength(1);
  });

  it('un trazado ajeno responde 404, no consulta los datos y queda auditado', async () => {
    await expect(
      servicio.demanda(IDS.otroTrazado, IDS.representante, null),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(consultas).toBe(0);
    expect(auditoria.eventos[0].tipo).toBe('acceso_denegado');
  });

  it('otro representante no ve el trazado 9001 aunque tenga el rol', async () => {
    await expect(
      servicio.conductores(IDS.trazado, '00000000-0000-4000-8000-000000000003'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
