import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { crearConsentimientos, IDS } from '../../../test/datos/recorrido-9001';
import type { UbicacionDoc } from '../../comun/mongo/mongo.servicio';
import type { JornadaFila, JornadasRepositorio } from '../jornadas/jornadas.repositorio';
import type { UbicacionesRepositorio } from '../jornadas/ubicaciones.repositorio';
import type { AbordajesRepositorio } from './abordajes.repositorio';
import { AbordajesServicio } from './abordajes.servicio';
import type { AvisosRepositorio } from './avisos.repositorio';

describe('AbordajesServicio ("me subi")', () => {
  const AHORA = new Date('2026-10-20T12:00:00Z');
  // Colectivo en el punto 2 de la ida.
  const COLECTIVO = { latitud: -33.6062, longitud: -70.5764 };
  // ~22 m al norte del colectivo.
  const PASAJERO_CERCA = { latitud: -33.6060, longitud: -70.5764 };
  // ~490 m: el punto 3 de la ida.
  const PASAJERO_LEJOS = { latitud: -33.6018, longitud: -70.5772 };

  let jornadaAbierta: JornadaFila | null;
  let ultima: UbicacionDoc | null;
  let abordajesHoy: number;
  let insertados: { distanciaM: number }[];
  let insertFalla: boolean;
  let avisosTerminados: number;
  let terminarFalla: boolean;
  let servicio: AbordajesServicio;

  const posicionHace = (segundos: number): UbicacionDoc => ({
    jornada_id: IDS.jornadaAbierta,
    vehiculo_id: IDS.vehiculo1,
    sentido_id: IDS.sentidoIda,
    ubicacion: { type: 'Point', coordinates: [COLECTIVO.longitud, COLECTIVO.latitud] },
    distancia_ruta_m: 483,
    velocidad_kmh: 0,
    asientos_disponibles: 2,
    registrada_en: new Date(AHORA.getTime() - segundos * 1000),
  });

  beforeEach(() => {
    jornadaAbierta = {
      id: IDS.jornadaAbierta,
      conductor_id: IDS.conductor1,
      vehiculo_id: IDS.vehiculo1,
      sentido_actual_id: IDS.sentidoIda,
      asientos_disponibles: 2,
      iniciada_en: AHORA,
      trazado_id: IDS.trazado,
      patente: 'ZZZZ01',
      capacidad: 4,
    };
    ultima = posicionHace(5);
    abordajesHoy = 0;
    insertados = [];
    insertFalla = false;
    avisosTerminados = 0;
    terminarFalla = false;

    servicio = new AbordajesServicio(
      {
        contarDeHoy: () => Promise.resolve(abordajesHoy),
        registrar: (d: { distanciaM: number }) => {
          if (insertFalla) return Promise.resolve(null);
          insertados.push(d);
          return Promise.resolve({ id: 'abordaje-1', abordado_en: AHORA, distancia_al_vehiculo_m: d.distanciaM });
        },
      } as unknown as AbordajesRepositorio,
      { buscarAbierta: () => Promise.resolve(jornadaAbierta) } as unknown as JornadasRepositorio,
      { ultima: () => Promise.resolve(ultima) } as unknown as UbicacionesRepositorio,
      {
        terminar: () => {
          if (terminarFalla) return Promise.reject(new Error('MongoDB no responde'));
          avisosTerminados++;
          return Promise.resolve(true);
        },
      } as unknown as AvisosRepositorio,
      crearConsentimientos({ acepto: true }),
    );
  });

  const subirse = (coordenada = PASAJERO_CERCA) =>
    servicio.registrar(IDS.pasajero1, { jornadaId: IDS.jornadaAbierta, coordenada }, AHORA);

  it('registra el viaje guardando solo la distancia, y termina el aviso de espera', async () => {
    const abordaje = await subirse();
    expect(abordaje.distancia_al_vehiculo_m).toBe(22);
    expect(insertados).toHaveLength(1);
    expect(avisosTerminados).toBe(1);
  });

  it('regla 4: a mas de 200 m responde 422 y no registra nada', async () => {
    await expect(subirse(PASAJERO_LEJOS)).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(insertados).toHaveLength(0);
  });

  it('regla 4: con la posicion del colectivo de hace mas de 60 s responde 422', async () => {
    ultima = posicionHace(90);
    await expect(subirse()).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('regla 9: el septimo viaje del dia responde 422', async () => {
    abordajesHoy = 6;
    await expect(subirse()).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('una jornada cerrada o inexistente responde 404', async () => {
    jornadaAbierta = null;
    await expect(subirse()).rejects.toBeInstanceOf(NotFoundException);
  });

  it('si la jornada se cierra entre la validacion y el INSERT responde 409', async () => {
    insertFalla = true;
    await expect(subirse()).rejects.toBeInstanceOf(ConflictException);
  });

  it('si falla terminar el aviso, el viaje igual queda registrado', async () => {
    terminarFalla = true;
    const abordaje = await subirse();
    expect(abordaje.id).toBe('abordaje-1');
  });
});
