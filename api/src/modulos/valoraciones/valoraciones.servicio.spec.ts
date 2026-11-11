import { ConflictException, NotFoundException } from '@nestjs/common';
import type { ValoracionesRepositorio } from './valoraciones.repositorio';
import { ValoracionesServicio } from './valoraciones.servicio';

describe('ValoracionesServicio', () => {
  const MIO = 'abordaje-mio';
  let calificados: Set<string>;
  let servicio: ValoracionesServicio;

  beforeEach(() => {
    calificados = new Set();
    servicio = new ValoracionesServicio({
      // Imita el INSERT ... SELECT con la condicion de pertenencia.
      calificar: (d: { abordajeId: string; pasajeroId: string; estrellas: number }) => {
        if (d.abordajeId !== MIO || d.pasajeroId !== 'pasajero-1') return Promise.resolve(null);
        if (calificados.has(d.abordajeId)) {
          return Promise.reject(Object.assign(new Error('duplicado'), { code: '23505' }));
        }
        calificados.add(d.abordajeId);
        return Promise.resolve({ abordaje_id: d.abordajeId, estrellas: d.estrellas, creada_en: new Date() });
      },
    } as unknown as ValoracionesRepositorio);
  });

  it('califica un viaje propio', async () => {
    const c = await servicio.calificar('pasajero-1', MIO, 5);
    expect(c.estrellas).toBe(5);
  });

  it('el viaje de otra persona responde 404 (no se confirma que exista)', async () => {
    await expect(servicio.calificar('pasajero-2', MIO, 1)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('calificar dos veces el mismo viaje responde 409', async () => {
    await servicio.calificar('pasajero-1', MIO, 4);
    await expect(servicio.calificar('pasajero-1', MIO, 1)).rejects.toBeInstanceOf(ConflictException);
  });
});
