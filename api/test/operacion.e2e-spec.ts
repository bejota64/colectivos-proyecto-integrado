import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { BaseDatosServicio } from '../src/comun/base-datos/base-datos.servicio';
import { MongoServicio } from '../src/comun/mongo/mongo.servicio';
import { configurarAplicacion } from '../src/configurar-aplicacion';

/**
 * Pruebas de integracion del flujo critico (Evaluacion 3): levantan la API
 * completa contra PostgreSQL y MongoDB de docker-compose, con los datos de
 * prueba cargados. Cada "it" dice que control de seguridad verifica.
 *
 * Usan la jornada abierta 302 (conductor1, ZZZZ01, sentido ida) de
 * 02_datos_prueba.sql. Los "it" van en orden y dependen del anterior.
 */

const CLAVE = 'Clave.Prueba.2026';
const CONDUCTOR = 'conductor1@colectivos.ejemplo.cl';
const PASAJERO = 'pasajero2@colectivos.ejemplo.cl';
const REPRESENTANTE = 'representante@colectivos.ejemplo.cl';
const TRAZADO = '00000000-0000-4000-8000-000000000100';
const SENTIDO_IDA = '00000000-0000-4000-8000-000000000101';
const JORNADA = '00000000-0000-4000-8000-000000000302';
const VEHICULO_LIBRE = '00000000-0000-4000-8000-000000000203';
const ABORDAJE_DE_PASAJERO1 = '00000000-0000-4000-8000-000000000401';
const PREFIJO = 'prueba-e2e-operacion-';

// Punto 2 del recorrido de ida (483 m) y un punto ~15 m al norte.
const PUNTO_2 = { latitud: -33.6062, longitud: -70.5764 };
const CERCA_DEL_PUNTO_2 = { latitud: -33.60607, longitud: -70.5764 };
// Calle paralela, ~300 m al poniente del recorrido.
const FUERA_DEL_RECORRIDO = { latitud: -33.6018, longitud: -70.5805 };

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('Operacion: jornada, mapa, "me subi", calificacion y panel', () => {
  let app: INestApplication;
  let servidor: Parameters<typeof request>[0];
  let baseDatos: BaseDatosServicio;
  let mongo: MongoServicio;
  let tokenConductor: string;
  let tokenPasajero: string;
  let tokenRepresentante: string;
  const abordajesCreados: string[] = [];

  const tokenDe = async (correo: string, contrasena = CLAVE) => {
    const r = await request(servidor)
      .post('/api/autenticacion/inicio-sesion')
      .send({ correo_electronico: correo, contrasena });
    return (r.body as { token_acceso: string }).token_acceso;
  };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication<NestExpressApplication>();
    configurarAplicacion(app as NestExpressApplication);
    await app.init();
    servidor = app.getHttpServer() as Parameters<typeof request>[0];
    baseDatos = app.get(BaseDatosServicio);
    mongo = app.get(MongoServicio);
    tokenConductor = await tokenDe(CONDUCTOR);
    tokenPasajero = await tokenDe(PASAJERO);
    tokenRepresentante = await tokenDe(REPRESENTANTE);
  });

  afterAll(async () => {
    // Deja la base como estaba: borra lo creado por estas pruebas.
    if (abordajesCreados.length > 0) {
      await baseDatos.consultar(`DELETE FROM calificaciones WHERE abordaje_id = ANY($1::uuid[])`, [abordajesCreados]);
      await baseDatos.consultar(`DELETE FROM abordajes WHERE id = ANY($1::uuid[])`, [abordajesCreados]);
    }
    const nuevos = await baseDatos.consultar<{ id: string }>(
      `SELECT id FROM usuarios WHERE correo_electronico LIKE $1`,
      [`${PREFIJO}%`],
    );
    await mongo.coleccion('avisos_espera').deleteMany({ pasajero_id: { $in: nuevos.map((u) => u.id) } });
    await baseDatos.consultar(`DELETE FROM usuarios WHERE correo_electronico LIKE $1`, [`${PREFIJO}%`]);
    await app.close();
  });

  describe('Control de acceso por rol (OWASP A01)', () => {
    it('E1: un pasajero no puede abrir una jornada (403)', async () => {
      const r = await request(servidor)
        .post('/api/jornadas')
        .set('Authorization', `Bearer ${tokenPasajero}`)
        .send({ vehiculo_id: VEHICULO_LIBRE, sentido_id: SENTIDO_IDA });
      expect(r.status).toBe(403);
    });

    it('E1: un conductor no puede ver el panel del representante (403)', async () => {
      const r = await request(servidor)
        .get(`/api/estadisticas/trazados/${TRAZADO}/demanda`)
        .set('Authorization', `Bearer ${tokenConductor}`);
      expect(r.status).toBe(403);
    });

    it('T2: el conductor no puede mandar un conductor_id ajeno al abrir jornada (400)', async () => {
      const r = await request(servidor)
        .post('/api/jornadas')
        .set('Authorization', `Bearer ${tokenConductor}`)
        .send({
          vehiculo_id: VEHICULO_LIBRE,
          sentido_id: SENTIDO_IDA,
          conductor_id: '00000000-0000-4000-8000-000000000012',
        });
      expect(r.status).toBe(400);
    });

    it('el conductor no puede abrir una segunda jornada (409)', async () => {
      const r = await request(servidor)
        .post('/api/jornadas')
        .set('Authorization', `Bearer ${tokenConductor}`)
        .send({ vehiculo_id: VEHICULO_LIBRE, sentido_id: SENTIDO_IDA });
      expect(r.status).toBe(409);
    });
  });

  describe('Posicion del conductor y asientos (Ley 21.377)', () => {
    it('acepta una posicion sobre el recorrido', async () => {
      const r = await request(servidor)
        .post('/api/tiempo-real/posiciones')
        .set('Authorization', `Bearer ${tokenConductor}`)
        .send(PUNTO_2);
      expect(r.status).toBe(201);
      expect((r.body as { distancia_ruta_m: number }).distancia_ruta_m).toBe(483);
    });

    it('rechaza una posicion fuera del recorrido (422)', async () => {
      const r = await request(servidor)
        .post('/api/tiempo-real/posiciones')
        .set('Authorization', `Bearer ${tokenConductor}`)
        .send(FUERA_DEL_RECORRIDO);
      expect(r.status).toBe(422);
    });

    it('rechaza coordenadas fuera de Chile en la validacion de entrada (400)', async () => {
      const r = await request(servidor)
        .post('/api/tiempo-real/posiciones')
        .set('Authorization', `Bearer ${tokenConductor}`)
        .send({ latitud: 48.85, longitud: 2.35 });
      expect(r.status).toBe(400);
    });

    it('en movimiento no deja cambiar asientos, aunque se salte la web (422)', async () => {
      await esperar(1100);
      // ~15 m en ~1,1 s: unos 50 km/h calculados por el servidor.
      await request(servidor)
        .post('/api/tiempo-real/posiciones')
        .set('Authorization', `Bearer ${tokenConductor}`)
        .send({ ...CERCA_DEL_PUNTO_2, velocidad_kmh: 0 });
      const r = await request(servidor)
        .patch('/api/jornadas/actual/asientos')
        .set('Authorization', `Bearer ${tokenConductor}`)
        .send({ asientos_disponibles: 1 });
      expect(r.status).toBe(422);
    });

    it('detenido si deja cambiar asientos', async () => {
      await esperar(1100);
      await request(servidor)
        .post('/api/tiempo-real/posiciones')
        .set('Authorization', `Bearer ${tokenConductor}`)
        .send(CERCA_DEL_PUNTO_2);
      const r = await request(servidor)
        .patch('/api/jornadas/actual/asientos')
        .set('Authorization', `Bearer ${tokenConductor}`)
        .send({ asientos_disponibles: 2 });
      expect(r.status).toBe(200);
    });
  });

  describe('Mapa y "me subi" (OWASP A06: solo opina quien viajo)', () => {
    it('el pasajero ve el colectivo con sus minutos estimados', async () => {
      const r = await request(servidor)
        .get(`/api/tiempo-real/colectivos?sentido_id=${SENTIDO_IDA}&latitud=-33.5975&longitud=-70.5781`)
        .set('Authorization', `Bearer ${tokenPasajero}`);
      expect(r.status).toBe(200);
      const zzzz01 = (r.body as { patente: string; minutos_estimados: number | null }[]).find(
        (c) => c.patente === 'ZZZZ01',
      );
      expect(zzzz01?.minutos_estimados).toBe(3);
    });

    it('lejos del colectivo no puede marcar "me subi" (422)', async () => {
      const r = await request(servidor)
        .post('/api/abordajes')
        .set('Authorization', `Bearer ${tokenPasajero}`)
        .send({ jornada_id: JORNADA, ...FUERA_DEL_RECORRIDO });
      expect(r.status).toBe(422);
    });

    it('cerca del colectivo registra el viaje y guarda solo la distancia', async () => {
      const r = await request(servidor)
        .post('/api/abordajes')
        .set('Authorization', `Bearer ${tokenPasajero}`)
        .send({ jornada_id: JORNADA, ...PUNTO_2 });
      expect(r.status).toBe(201);
      const cuerpo = r.body as { id: string; distancia_al_vehiculo_m: number };
      abordajesCreados.push(cuerpo.id);
      expect(cuerpo.distancia_al_vehiculo_m).toBeLessThan(200);
      expect(JSON.stringify(r.body)).not.toContain('latitud');
    });

    it('califica su propio viaje una sola vez (201 y luego 409)', async () => {
      const ruta = `/api/abordajes/${abordajesCreados[0]}/calificacion`;
      const primera = await request(servidor).post(ruta).set('Authorization', `Bearer ${tokenPasajero}`).send({ estrellas: 5 });
      const segunda = await request(servidor).post(ruta).set('Authorization', `Bearer ${tokenPasajero}`).send({ estrellas: 1 });
      expect(primera.status).toBe(201);
      expect(segunda.status).toBe(409);
    });

    it('no puede calificar el viaje de otra persona: 404, no confirma que exista', async () => {
      const r = await request(servidor)
        .post(`/api/abordajes/${ABORDAJE_DE_PASAJERO1}/calificacion`)
        .set('Authorization', `Bearer ${tokenPasajero}`)
        .send({ estrellas: 1 });
      expect(r.status).toBe(404);
    });

    it('un id que no es uuid se rechaza antes de llegar a la base (400)', async () => {
      const r = await request(servidor)
        .post(`/api/abordajes/1%27%20OR%20%271%27=%271/calificacion`)
        .set('Authorization', `Bearer ${tokenPasajero}`)
        .send({ estrellas: 1 });
      expect(r.status).toBe(400);
    });
  });

  describe('Consentimiento de ubicacion (Ley 19.628 y Ley 21.719)', () => {
    it('sin consentimiento no puede avisar; tras aceptarlo, si', async () => {
      const correo = `${PREFIJO}${Date.now()}@ejemplo.cl`;
      await request(servidor).post('/api/autenticacion/registro').send({
        nombre_completo: 'Persona de Prueba',
        correo_electronico: correo,
        contrasena: 'caballo-pila-grapa-azul',
        acepta_terminos: true,
      });
      const token = await tokenDe(correo, 'caballo-pila-grapa-azul');
      const aviso = { sentido_id: SENTIDO_IDA, ...PUNTO_2, personas: 2 };

      const sinConsentimiento = await request(servidor).post('/api/avisos-espera').set('Authorization', `Bearer ${token}`).send(aviso);
      expect(sinConsentimiento.status).toBe(403);

      await request(servidor).post('/api/usuarios/yo/consentimientos/geolocalizacion').set('Authorization', `Bearer ${token}`);
      const conConsentimiento = await request(servidor).post('/api/avisos-espera').set('Authorization', `Bearer ${token}`).send(aviso);
      expect(conConsentimiento.status).toBe(201);
    });
  });

  describe('Panel del representante: rol + pertenencia', () => {
    it('ve la demanda de su trazado', async () => {
      // Los datos de prueba cargan la demanda del "dia anterior" a cuando se
      // creo la base, que puede no ser ayer: se usa la fecha que exista.
      const [{ fecha }] = await baseDatos.consultar<{ fecha: string }>(
        `SELECT min(fecha)::text AS fecha FROM demanda_por_tramo`,
      );
      const r = await request(servidor)
        .get(`/api/estadisticas/trazados/${TRAZADO}/demanda?fecha=${fecha}`)
        .set('Authorization', `Bearer ${tokenRepresentante}`);
      expect(r.status).toBe(200);
      expect((r.body as unknown[]).length).toBeGreaterThan(0);
    });

    it('un trazado que no es suyo responde 404', async () => {
      const r = await request(servidor)
        .get('/api/estadisticas/trazados/00000000-0000-4000-8000-000000000999/demanda')
        .set('Authorization', `Bearer ${tokenRepresentante}`);
      expect(r.status).toBe(404);
    });

    it('rechaza una fecha que no existe (400)', async () => {
      const r = await request(servidor)
        .get(`/api/estadisticas/trazados/${TRAZADO}/demanda?fecha=2026-02-30`)
        .set('Authorization', `Bearer ${tokenRepresentante}`);
      expect(r.status).toBe(400);
    });

    it('el resumen por conductor no trae datos de pasajeros', async () => {
      const r = await request(servidor)
        .get(`/api/estadisticas/trazados/${TRAZADO}/conductores`)
        .set('Authorization', `Bearer ${tokenRepresentante}`);
      expect(r.status).toBe(200);
      expect(JSON.stringify(r.body)).not.toContain('pasajero');
    });
  });
});
