import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  crearConsentimientos,
  IDA_9001,
  IDS,
  SENTIDO_IDA,
} from '../../../test/datos/recorrido-9001';
import type { AvisoEsperaDoc } from '../../comun/mongo/mongo.servicio';
import type { JornadasServicio } from '../jornadas/jornadas.servicio';
import type { UbicacionesRepositorio } from '../jornadas/ubicaciones.repositorio';
import { RutasServicio } from '../trazados/rutas.servicio';
import type { TrazadosRepositorio } from '../trazados/trazados.repositorio';
import type { AvisosRepositorio } from './avisos.repositorio';
import type { DemandaRepositorio } from './demanda.repositorio';
import { AvisosServicio } from './avisos.servicio';

describe('AvisosServicio ("estoy esperando")', () => {
  const AHORA = new Date('2026-10-20T12:00:00Z');
  const minutosDespues = (m: number) => new Date(AHORA.getTime() + m * 60_000);
  // Punto 4 del recorrido de ida: 1463 m desde el inicio, tramo 2.
  const SOBRE_LA_RUTA = { latitud: -33.5975, longitud: -70.5781 };

  let avisos: AvisoEsperaDoc[];
  let sumas: { numeroTramo: number; personas: number }[];
  let fallaPostgres: boolean;
  let consentimiento: { acepto: boolean };
  let servicio: AvisosServicio;

  beforeEach(() => {
    avisos = [];
    sumas = [];
    fallaPostgres = false;
    consentimiento = { acepto: true };

    const avisosFalso = {
      buscar: (id: string) => Promise.resolve(avisos.find((a) => a.pasajero_id === id) ?? null),
      crear: (a: AvisoEsperaDoc) => {
        if (avisos.some((x) => x.pasajero_id === a.pasajero_id)) return Promise.resolve(false);
        avisos.push({ ...a });
        return Promise.resolve(true);
      },
      reactivar: (id: string, cambios: Partial<AvisoEsperaDoc>) => {
        const a = avisos.find((x) => x.pasajero_id === id);
        if (a) Object.assign(a, cambios, { terminado_en: null });
        return Promise.resolve();
      },
      eliminar: (id: string) => {
        avisos = avisos.filter((a) => a.pasajero_id !== id);
        return Promise.resolve();
      },
      terminar: (id: string, ahora: Date) => {
        const a = avisos.find(
          (x) => x.pasajero_id === id && x.terminado_en === null && x.expira_en > ahora,
        );
        if (a) a.terminado_en = ahora;
        return Promise.resolve(Boolean(a));
      },
    } as unknown as AvisosRepositorio;

    const demandaFalso = {
      sumarAviso: (d: { numeroTramo: number; personas: number }) => {
        if (fallaPostgres) return Promise.reject(new Error('PostgreSQL no responde'));
        sumas.push(d);
        return Promise.resolve();
      },
    } as unknown as DemandaRepositorio;

    const trazadosFalso = {
      buscarSentido: (id: string) => Promise.resolve(id === IDS.sentidoIda ? SENTIDO_IDA : null),
      puntosRuta: () => Promise.resolve(IDA_9001),
    } as unknown as TrazadosRepositorio;

    servicio = new AvisosServicio(
      avisosFalso,
      demandaFalso,
      new RutasServicio(trazadosFalso), // proyeccion real sobre el recorrido 9001
      trazadosFalso,
      crearConsentimientos(consentimiento),
      {} as JornadasServicio,
      {} as UbicacionesRepositorio,
    );
  });

  const avisar = (cuando: Date, personas = 2) =>
    servicio.avisar(
      IDS.pasajero1,
      { sentidoId: IDS.sentidoIda, coordenada: SOBRE_LA_RUTA, personas },
      cuando,
    );

  it('crea el aviso y suma la demanda una vez, en el tramo correcto', async () => {
    const resultado = await avisar(AHORA);
    expect(resultado.reactivado).toBe(false);
    expect(resultado.numero_tramo).toBe(2);
    expect(sumas).toEqual([{ sentidoId: IDS.sentidoIda, numeroTramo: 2, personas: 2 }]);
  });

  it('regla 7: avisar de nuevo dentro de 20 minutos reactiva el mismo aviso y NO suma otra vez', async () => {
    await avisar(AHORA);
    await servicio.cancelar(IDS.pasajero1, minutosDespues(5));
    const segundo = await avisar(minutosDespues(10), 3);
    expect(segundo.reactivado).toBe(true);
    expect(sumas).toHaveLength(1);
    expect(avisos).toHaveLength(1);
    expect(avisos[0].personas).toBe(3);
  });

  it('un aviso vencido pero aun no borrado por MongoDB se reemplaza y si suma', async () => {
    await avisar(AHORA);
    const nuevo = await avisar(minutosDespues(21));
    expect(nuevo.reactivado).toBe(false);
    expect(sumas).toHaveLength(2);
    expect(avisos).toHaveLength(1);
  });

  it('fuera del recorrido responde 422 y no escribe en ninguna base', async () => {
    await expect(
      servicio.avisar(
        IDS.pasajero1,
        { sentidoId: IDS.sentidoIda, coordenada: { latitud: -33.6018, longitud: -70.5805 }, personas: 1 },
        AHORA,
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(avisos).toHaveLength(0);
    expect(sumas).toHaveLength(0);
  });

  it('si PostgreSQL falla, el aviso de MongoDB se deshace (compensacion)', async () => {
    fallaPostgres = true;
    await expect(avisar(AHORA)).rejects.toMatchObject({ message: 'PostgreSQL no responde' });
    expect(avisos).toHaveLength(0);
  });

  it('un sentido que no existe responde 404', async () => {
    await expect(
      servicio.avisar(
        IDS.pasajero1,
        { sentidoId: '00000000-0000-4000-8000-000000000555', coordenada: SOBRE_LA_RUTA, personas: 1 },
        AHORA,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sin consentimiento de ubicacion responde 403 y no guarda nada', async () => {
    consentimiento.acepto = false;
    await expect(avisar(AHORA)).rejects.toBeInstanceOf(ForbiddenException);
    expect(avisos).toHaveLength(0);
  });

  it('cancelar sin un aviso activo responde 404', async () => {
    await expect(servicio.cancelar(IDS.pasajero1, AHORA)).rejects.toBeInstanceOf(NotFoundException);
  });
});
