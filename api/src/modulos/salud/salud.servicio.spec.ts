import { Logger, ServiceUnavailableException } from '@nestjs/common';
import type { BaseDatosServicio } from '../../comun/base-datos/base-datos.servicio';
import type { MongoServicio } from '../../comun/mongo/mongo.servicio';
import { ESPERA_MAXIMA_SALUD_MS, SaludServicio } from './salud.servicio';

const responde = () => Promise.resolve();
const falla = () => Promise.reject(new Error('conexion rechazada'));
const nuncaResponde = () => new Promise<void>(() => undefined);

const servicioCon = (
  postgres: () => Promise<unknown>,
  mongo: () => Promise<void>,
) =>
  new SaludServicio(
    { consultar: postgres } as unknown as BaseDatosServicio,
    { ping: mongo } as unknown as MongoServicio,
  );

describe('SaludServicio', () => {
  beforeEach(() => {
    // El aviso al log es lo esperado cuando una base falla; aqui no hace falta verlo.
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('responde ok cuando las dos bases contestan', async () => {
    await expect(servicioCon(responde, responde).revisar()).resolves.toEqual({
      estado: 'ok',
    });
  });

  it('responde 503 si PostgreSQL no contesta', async () => {
    await expect(servicioCon(falla, responde).revisar()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('responde 503 si MongoDB no contesta', async () => {
    await expect(servicioCon(responde, falla).revisar()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('no le dice al cliente que base fallo', async () => {
    const error = await servicioCon(falla, responde)
      .revisar()
      .catch((e: unknown) => e as ServiceUnavailableException);
    expect(JSON.stringify(error.getResponse())).not.toMatch(/postgres|mongo/i);
  });

  it('da por caida una base que no responde a tiempo', async () => {
    jest.useFakeTimers();
    const revision = servicioCon(nuncaResponde, responde).revisar();
    jest.advanceTimersByTime(ESPERA_MAXIMA_SALUD_MS);
    await expect(revision).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
