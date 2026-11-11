import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { BaseDatosServicio } from '../src/comun/base-datos/base-datos.servicio';
import { configurarAplicacion } from '../src/configurar-aplicacion';

/**
 * Pruebas de integracion: levantan la API completa y la llaman por HTTP,
 * contra el PostgreSQL de docker-compose con los datos de prueba cargados.
 * Cada "it" indica la amenaza del analisis STRIDE que verifica.
 */

const CLAVE_DATOS_PRUEBA = 'Clave.Prueba.2026';
const REPRESENTANTE = 'representante@colectivos.ejemplo.cl';
const PASAJERO = 'pasajero1@colectivos.ejemplo.cl';
const CONDUCTOR = 'conductor3@colectivos.ejemplo.cl';
const PREFIJO = 'prueba-e2e-';

interface CuerpoSesion {
  token_acceso: string;
  usuario: { id: string; rol: string };
}
interface CuerpoUsuario {
  id: string;
  correo_electronico: string;
  rol: string;
}
interface CuerpoError {
  message: string | string[];
}

// Ojo: las rutas de credenciales aceptan 20 peticiones por minuto por IP.
// Este archivo hace 17 inicios de sesion; si agregas mas, puedes recibir 429.

describe('Autenticacion y control de acceso', () => {
  let app: INestApplication;
  let baseDatos: BaseDatosServicio;
  let servidor: Parameters<typeof request>[0];

  const tokenDe = async (correo: string): Promise<string> => {
    const respuesta = await iniciarSesion(correo, CLAVE_DATOS_PRUEBA);
    return (respuesta.body as CuerpoSesion).token_acceso;
  };

  const correoNuevo = () =>
    `${PREFIJO}${Date.now()}-${Math.round(Math.random() * 1e6)}@ejemplo.cl`;

  const iniciarSesion = (correo: string, contrasena: string) =>
    request(servidor)
      .post('/api/autenticacion/inicio-sesion')
      .send({ correo_electronico: correo, contrasena });

  const cookieDe = (respuesta: request.Response): string => {
    const cabecera = respuesta.headers['set-cookie'] as unknown as
      | string[]
      | undefined;
    return cabecera?.[0] ?? '';
  };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = modulo.createNestApplication<NestExpressApplication>();
    configurarAplicacion(app as NestExpressApplication);
    await app.init();
    servidor = app.getHttpServer() as Parameters<typeof request>[0];
    baseDatos = app.get(BaseDatosServicio);
  });

  afterAll(async () => {
    // Borra solo las cuentas creadas por estas pruebas; sus tokens y consentimientos caen en cascada.
    await baseDatos.consultar(
      `DELETE FROM usuarios WHERE correo_electronico LIKE $1`,
      [`${PREFIJO}%`],
    );
    await baseDatos.consultar(
      `DELETE FROM tokens_refresco WHERE usuario_id IN
         (SELECT id FROM usuarios WHERE correo_electronico LIKE '%@colectivos.ejemplo.cl')`,
    );
    await app.close();
  });

  describe('Registro', () => {
    it('crea un pasajero y no devuelve el hash de la contrasena', async () => {
      const respuesta = await request(servidor)
        .post('/api/autenticacion/registro')
        .send({
          nombre_completo: 'Persona de Prueba',
          correo_electronico: correoNuevo(),
          contrasena: 'caballo-pila-grapa-azul',
          acepta_terminos: true,
        });
      expect(respuesta.status).toBe(201);
      expect((respuesta.body as CuerpoUsuario).rol).toBe('pasajero');
      expect(JSON.stringify(respuesta.body)).not.toContain('hash');
    });

    it('T2: rechaza el campo rol enviado por el cliente', async () => {
      const respuesta = await request(servidor)
        .post('/api/autenticacion/registro')
        .send({
          nombre_completo: 'Persona de Prueba',
          correo_electronico: correoNuevo(),
          contrasena: 'caballo-pila-grapa-azul',
          acepta_terminos: true,
          rol: 'administrador',
        });
      expect(respuesta.status).toBe(400);
    });

    it('T1: rechaza un objeto donde se espera texto', async () => {
      const respuesta = await iniciarSesion(
        { $gt: '' } as unknown as string,
        'cualquier-cosa',
      );
      expect(respuesta.status).toBe(400);
    });

    it('S1: rechaza una contrasena corta y una comun', async () => {
      const base = {
        nombre_completo: 'Persona de Prueba',
        acepta_terminos: true,
      };
      const corta = await request(servidor)
        .post('/api/autenticacion/registro')
        .send({
          ...base,
          correo_electronico: correoNuevo(),
          contrasena: 'corta123',
        });
      const comun = await request(servidor)
        .post('/api/autenticacion/registro')
        .send({
          ...base,
          correo_electronico: correoNuevo(),
          contrasena: 'password1234',
        });
      expect(corta.status).toBe(400);
      expect(comun.status).toBe(400);
    });

    it('exige aceptar los terminos', async () => {
      const respuesta = await request(servidor)
        .post('/api/autenticacion/registro')
        .send({
          nombre_completo: 'Persona de Prueba',
          correo_electronico: correoNuevo(),
          contrasena: 'caballo-pila-grapa-azul',
          acepta_terminos: false,
        });
      expect(respuesta.status).toBe(400);
    });
  });

  describe('Inicio de sesion', () => {
    it('entrega el token de acceso en el cuerpo y el de refresco solo en una cookie protegida', async () => {
      const respuesta = await iniciarSesion(PASAJERO, CLAVE_DATOS_PRUEBA);
      expect(respuesta.status).toBe(200);
      expect(typeof (respuesta.body as CuerpoSesion).token_acceso).toBe(
        'string',
      );
      expect(JSON.stringify(respuesta.body)).not.toContain('token_refresco');
      const cookie = cookieDe(respuesta);
      expect(cookie).toContain('token_refresco=');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Strict');
      expect(cookie).toContain('Path=/api/autenticacion');
    });

    it('I7: mismo mensaje si el correo no existe o la contrasena es incorrecta', async () => {
      const sinCuenta = await iniciarSesion(
        'nadie-existe@ejemplo.cl',
        'una-contrasena-larga',
      );
      const claveMala = await iniciarSesion(PASAJERO, 'una-contrasena-larga');
      expect(sinCuenta.status).toBe(401);
      expect(claveMala.status).toBe(401);
      expect((sinCuenta.body as CuerpoError).message).toBe(
        (claveMala.body as CuerpoError).message,
      );
    });

    it('S1: al sexto intento fallido responde 429, incluso con la contrasena correcta', async () => {
      for (let i = 0; i < 5; i++) {
        expect(
          (await iniciarSesion(CONDUCTOR, 'contrasena-incorrecta')).status,
        ).toBe(401);
      }
      expect(
        (await iniciarSesion(CONDUCTOR, 'contrasena-incorrecta')).status,
      ).toBe(429);
      expect((await iniciarSesion(CONDUCTOR, CLAVE_DATOS_PRUEBA)).status).toBe(
        429,
      );
    });
  });

  describe('Rutas protegidas', () => {
    it('la ruta de salud responde sin sesion y solo dice "ok"', async () => {
      const respuesta = await request(servidor).get('/api/salud');
      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toEqual({ estado: 'ok' });
    });

    it('E1: sin token responde 401', async () => {
      expect((await request(servidor).get('/api/usuarios/yo')).status).toBe(
        401,
      );
    });

    it('con token devuelve el perfil propio', async () => {
      const token = await tokenDe(PASAJERO);
      const respuesta = await request(servidor)
        .get('/api/usuarios/yo')
        .set('Authorization', `Bearer ${token}`);
      expect(respuesta.status).toBe(200);
      expect((respuesta.body as CuerpoUsuario).correo_electronico).toBe(
        PASAJERO,
      );
      expect(respuesta.body).not.toHaveProperty('contrasena_hash');
    });

    it('E2: un token alterado responde 401', async () => {
      const token = await tokenDe(PASAJERO);
      const [cabecera, , firma] = token.split('.');
      const contenidoFalso = Buffer.from(
        JSON.stringify({ sub: 'x', rol: 'administrador' }),
      ).toString('base64url');
      const respuesta = await request(servidor)
        .get('/api/usuarios/yo')
        .set('Authorization', `Bearer ${cabecera}.${contenidoFalso}.${firma}`);
      expect(respuesta.status).toBe(401);
    });

    it('E1: un pasajero no entra a una ruta de representante (403)', async () => {
      const token = await tokenDe(PASAJERO);
      const respuesta = await request(servidor)
        .get('/api/trazados/mios')
        .set('Authorization', `Bearer ${token}`);
      expect(respuesta.status).toBe(403);
    });

    it('el representante ve solo sus trazados', async () => {
      const token = await tokenDe(REPRESENTANTE);
      const respuesta = await request(servidor)
        .get('/api/trazados/mios')
        .set('Authorization', `Bearer ${token}`);
      const trazados = respuesta.body as { codigo: string }[];
      expect(respuesta.status).toBe(200);
      expect(trazados).toHaveLength(1);
      expect(trazados[0].codigo).toBe('9001');
    });
  });

  describe('Sesion', () => {
    it('S2: renovar rota el token, y reusar el anterior cierra todas las sesiones', async () => {
      const inicio = await iniciarSesion(REPRESENTANTE, CLAVE_DATOS_PRUEBA);
      const cookieVieja = cookieDe(inicio);

      const renovada = await request(servidor)
        .post('/api/autenticacion/renovar')
        .set('Cookie', cookieVieja);
      expect(renovada.status).toBe(200);
      const cookieNueva = cookieDe(renovada);
      expect(cookieNueva).not.toBe(cookieVieja);

      const reuso = await request(servidor)
        .post('/api/autenticacion/renovar')
        .set('Cookie', cookieVieja);
      expect(reuso.status).toBe(401);
      const trasElReuso = await request(servidor)
        .post('/api/autenticacion/renovar')
        .set('Cookie', cookieNueva);
      expect(trasElReuso.status).toBe(401);
    });

    it('sin cookie no se puede renovar', async () => {
      expect(
        (await request(servidor).post('/api/autenticacion/renovar')).status,
      ).toBe(401);
    });

    it('cerrar sesion invalida el token de refresco', async () => {
      const inicio = await iniciarSesion(PASAJERO, CLAVE_DATOS_PRUEBA);
      const cookie = cookieDe(inicio);
      expect(
        (
          await request(servidor)
            .post('/api/autenticacion/cierre-sesion')
            .set('Cookie', cookie)
        ).status,
      ).toBe(204);
      expect(
        (
          await request(servidor)
            .post('/api/autenticacion/renovar')
            .set('Cookie', cookie)
        ).status,
      ).toBe(401);
    });
  });
});
