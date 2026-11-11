import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  crearAuditoriaFalsa,
  crearConsentimientos,
  IDS,
  SENTIDO_IDA,
} from '../../../test/datos/recorrido-9001';
import type { UbicacionDoc } from '../../comun/mongo/mongo.servicio';
import type { AuditoriaServicio } from '../auditoria/auditoria.servicio';
import type { FlotaRepositorio } from '../flota/flota.repositorio';
import type { TrazadosRepositorio } from '../trazados/trazados.repositorio';
import type { JornadaFila, JornadasRepositorio } from './jornadas.repositorio';
import { JornadasServicio, MENSAJE_JORNADA_CERRADA } from './jornadas.servicio';
import type { UbicacionesRepositorio } from './ubicaciones.repositorio';

/**
 * Pruebas unitarias del servicio de jornadas, con repositorios falsos en
 * memoria (mismo enfoque que autenticacion.servicio.spec.ts).
 */
describe('JornadasServicio', () => {
  const AHORA = new Date('2026-10-20T12:00:00Z');
  let jornadas: JornadaFila[];
  let ultimaUbicacion: UbicacionDoc | null;
  let consentimiento: { acepto: boolean };
  let conductorHabilitado: boolean;
  let auditoria: ReturnType<typeof crearAuditoriaFalsa>;
  let servicio: JornadasServicio;

  const vehiculo = {
    id: IDS.vehiculo1,
    patente: 'ZZZZ01',
    marca: 'Nissan',
    modelo: 'Versa',
    capacidad: 4,
  };

  const posicion = (velocidad: number, haceSegundos: number): UbicacionDoc => ({
    jornada_id: 'jornada-1',
    vehiculo_id: IDS.vehiculo1,
    sentido_id: IDS.sentidoIda,
    ubicacion: { type: 'Point', coordinates: [-70.5764, -33.6062] },
    distancia_ruta_m: 483,
    velocidad_kmh: velocidad,
    asientos_disponibles: 4,
    registrada_en: new Date(AHORA.getTime() - haceSegundos * 1000),
  });

  beforeEach(() => {
    jornadas = [];
    ultimaUbicacion = null;
    consentimiento = { acepto: true };
    conductorHabilitado = true;
    auditoria = crearAuditoriaFalsa();

    const jornadasFalso = {
      abrir: (d: { conductorId: string; vehiculoId: string; sentidoId: string; asientos: number }) => {
        if (jornadas.some((j) => j.conductor_id === d.conductorId || j.vehiculo_id === d.vehiculoId)) {
          // Lo que haria PostgreSQL con los indices unicos parciales.
          return Promise.reject(Object.assign(new Error('duplicado'), { code: '23505' }));
        }
        jornadas.push({
          id: 'jornada-1',
          conductor_id: d.conductorId,
          vehiculo_id: d.vehiculoId,
          sentido_actual_id: d.sentidoId,
          asientos_disponibles: d.asientos,
          iniciada_en: AHORA,
          trazado_id: IDS.trazado,
          patente: vehiculo.patente,
          capacidad: vehiculo.capacidad,
        });
        return Promise.resolve('jornada-1');
      },
      buscarAbiertaDeConductor: (id: string) =>
        Promise.resolve(jornadas.find((j) => j.conductor_id === id) ?? null),
      actualizarAsientos: (id: string, asientos: number) => {
        const j = jornadas.find((x) => x.id === id);
        if (j) j.asientos_disponibles = asientos;
        return Promise.resolve(Boolean(j));
      },
      cerrar: (id: string) => {
        const antes = jornadas.length;
        jornadas = jornadas.filter((j) => j.id !== id);
        return Promise.resolve(jornadas.length < antes);
      },
    } as unknown as JornadasRepositorio;

    const flotaFalso = {
      buscarConductor: (id: string) =>
        Promise.resolve(
          id === IDS.conductor1
            ? { usuario_id: id, trazado_id: IDS.trazado, habilitado: conductorHabilitado }
            : null,
        ),
      // Solo encuentra el vehiculo si se pide con el trazado correcto (regla 2).
      buscarVehiculoDeTrazado: (vehiculoId: string, trazadoId: string) =>
        Promise.resolve(
          vehiculoId === vehiculo.id && trazadoId === IDS.trazado ? vehiculo : null,
        ),
    } as unknown as FlotaRepositorio;

    const trazadosFalso = {
      buscarSentido: (id: string) =>
        Promise.resolve(
          id === IDS.sentidoIda
            ? SENTIDO_IDA
            : id === 'sentido-ajeno'
              ? { ...SENTIDO_IDA, id, trazado_id: IDS.otroTrazado }
              : null,
        ),
    } as unknown as TrazadosRepositorio;

    const ubicacionesFalso = {
      ultima: () => Promise.resolve(ultimaUbicacion),
    } as unknown as UbicacionesRepositorio;

    servicio = new JornadasServicio(
      jornadasFalso,
      ubicacionesFalso,
      flotaFalso,
      trazadosFalso,
      crearConsentimientos(consentimiento),
      auditoria as unknown as AuditoriaServicio,
    );
  });

  const abrir = () =>
    servicio.abrir(IDS.conductor1, {
      vehiculoId: IDS.vehiculo1,
      sentidoId: IDS.sentidoIda,
    });

  describe('Abrir jornada', () => {
    it('abre con todos los asientos libres y queda auditada', async () => {
      const jornada = await abrir();
      expect(jornada.asientos_disponibles).toBe(4);
      expect(auditoria.eventos[0].tipo).toBe('inicio_jornada');
    });

    it('regla 2: un vehiculo de otro trazado responde 404 y queda auditado', async () => {
      await expect(
        servicio.abrir(IDS.conductor1, {
          vehiculoId: '00000000-0000-4000-8000-000000000777',
          sentidoId: IDS.sentidoIda,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(auditoria.eventos[0].tipo).toBe('acceso_denegado');
    });

    it('regla 2: un sentido de otro trazado responde 404', async () => {
      await expect(
        servicio.abrir(IDS.conductor1, { vehiculoId: IDS.vehiculo1, sentidoId: 'sentido-ajeno' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('un conductor deshabilitado recibe 403', async () => {
      conductorHabilitado = false;
      await expect(abrir()).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('sin consentimiento de ubicacion recibe 403 (Ley 21.719)', async () => {
      consentimiento.acepto = false;
      await expect(abrir()).rejects.toBeInstanceOf(ForbiddenException);
      expect(jornadas).toHaveLength(0);
    });

    it('no puede abrir una segunda jornada (409)', async () => {
      await abrir();
      await expect(abrir()).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('Asientos', () => {
    beforeEach(async () => {
      await abrir();
    });

    it('cambia los asientos con el auto detenido', async () => {
      ultimaUbicacion = posicion(0, 3);
      const jornada = await servicio.cambiarAsientos(IDS.conductor1, 1, AHORA);
      expect(jornada.asientos_disponibles).toBe(1);
    });

    it('Ley 21.377: rechaza el cambio en movimiento aunque la web no lo bloquee (422)', async () => {
      ultimaUbicacion = posicion(32, 3);
      await expect(
        servicio.cambiarAsientos(IDS.conductor1, 1, AHORA),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(jornadas[0].asientos_disponibles).toBe(4);
    });

    it('regla 3: no acepta mas asientos que la capacidad (400)', async () => {
      jornadas[0].capacidad = 3;
      ultimaUbicacion = posicion(0, 3);
      await expect(
        servicio.cambiarAsientos(IDS.conductor1, 4, AHORA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('Regla 8: jornada cerrada', () => {
    it('sin jornada abierta responde 409 "Jornada cerrada"', async () => {
      await expect(
        servicio.cambiarAsientos(IDS.conductor1, 2, AHORA),
      ).rejects.toMatchObject({ message: MENSAJE_JORNADA_CERRADA });
    });

    it('cerrar deja la jornada cerrada y queda auditado', async () => {
      await abrir();
      await servicio.cerrar(IDS.conductor1);
      expect(jornadas).toHaveLength(0);
      expect(auditoria.eventos[1].tipo).toBe('fin_jornada');
    });
  });
});
