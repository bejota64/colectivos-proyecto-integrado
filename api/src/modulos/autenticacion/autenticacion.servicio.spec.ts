import { HttpException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  UsuarioFila,
  UsuariosRepositorio,
} from '../usuarios/usuarios.repositorio';
import { AutenticacionServicio } from './autenticacion.servicio';
import { ContrasenasServicio } from './contrasenas.servicio';
import { IntentosServicio } from './intentos.servicio';
import { TokenRefrescoFila, TokensRepositorio } from './tokens.repositorio';

/**
 * Pruebas unitarias: el servicio se prueba solo, con repositorios falsos en
 * memoria. No tocan la base de datos, por eso corren en milisegundos.
 */

const CONTRASENA = 'caballo-pila-grapa-azul';

function crearUsuariosFalso(usuarios: UsuarioFila[]) {
  return {
    buscarPorCorreo: (correo: string) =>
      Promise.resolve(
        usuarios.find((u) => u.correo_electronico === correo) ?? null,
      ),
    buscarPorId: (id: string) =>
      Promise.resolve(usuarios.find((u) => u.id === id) ?? null),
    crearPasajero: (datos: {
      nombreCompleto: string;
      correo: string;
      contrasenaHash: string;
    }) => {
      if (usuarios.some((u) => u.correo_electronico === datos.correo))
        return Promise.resolve(null);
      const nuevo: UsuarioFila = {
        id: `usuario-${usuarios.length + 1}`,
        nombre_completo: datos.nombreCompleto,
        correo_electronico: datos.correo,
        contrasena_hash: datos.contrasenaHash,
        rol: 'pasajero',
        activo: true,
      };
      usuarios.push(nuevo);
      return Promise.resolve(nuevo);
    },
  } as unknown as UsuariosRepositorio;
}

function crearTokensFalso(
  filas: (TokenRefrescoFila & { token_hash: string })[],
) {
  return {
    crear: (datos: {
      usuarioId: string;
      tokenHash: string;
      expiraEn: Date;
    }) => {
      filas.push({
        id: `token-${filas.length + 1}`,
        usuario_id: datos.usuarioId,
        token_hash: datos.tokenHash,
        expira_en: datos.expiraEn,
        revocado_en: null,
      });
      return Promise.resolve();
    },
    buscarPorHash: (hash: string) =>
      Promise.resolve(filas.find((f) => f.token_hash === hash) ?? null),
    revocar: (id: string) => {
      const fila = filas.find((f) => f.id === id && f.revocado_en === null);
      if (!fila) return Promise.resolve(false);
      fila.revocado_en = new Date();
      return Promise.resolve(true);
    },
    revocarTodosDeUsuario: (usuarioId: string) => {
      for (const fila of filas) {
        if (fila.usuario_id === usuarioId && fila.revocado_en === null)
          fila.revocado_en = new Date();
      }
      return Promise.resolve();
    },
  } as unknown as TokensRepositorio;
}

/** Contrasenas falsas: guarda "hash:<texto>" para no gastar tiempo en bcrypt. */
const contrasenasFalso = {
  revisarPolitica: () => null,
  generarHash: (contrasena: string) => Promise.resolve(`hash:${contrasena}`),
  coincide: (contrasena: string, hash: string | null) =>
    Promise.resolve(hash === `hash:${contrasena}`),
} as unknown as ContrasenasServicio;

describe('AutenticacionServicio', () => {
  let usuarios: UsuarioFila[];
  let tokens: (TokenRefrescoFila & { token_hash: string })[];
  let servicio: AutenticacionServicio;
  let jwt: JwtService;

  beforeEach(() => {
    usuarios = [
      {
        id: 'usuario-1',
        nombre_completo: 'Persona de Prueba',
        correo_electronico: 'persona@ejemplo.cl',
        contrasena_hash: `hash:${CONTRASENA}`,
        rol: 'representante',
        activo: true,
      },
    ];
    tokens = [];
    jwt = new JwtService({
      secret: 'secreto-de-prueba-de-mas-de-32-caracteres',
      signOptions: { expiresIn: '15m' },
    });
    servicio = new AutenticacionServicio(
      crearUsuariosFalso(usuarios),
      crearTokensFalso(tokens),
      contrasenasFalso,
      new IntentosServicio(),
      jwt,
    );
  });

  it('inicia sesion y entrega un token de acceso con el id y el rol', async () => {
    const sesion = await servicio.iniciarSesion(
      'persona@ejemplo.cl',
      CONTRASENA,
    );
    const contenido = await jwt.verifyAsync<{ sub: string; rol: string }>(
      sesion.token_acceso,
    );
    expect(contenido.sub).toBe('usuario-1');
    expect(contenido.rol).toBe('representante');
    expect(sesion.usuario).not.toHaveProperty('contrasena_hash');
  });

  it('guarda el hash del token de refresco, no el token', async () => {
    const sesion = await servicio.iniciarSesion(
      'persona@ejemplo.cl',
      CONTRASENA,
    );
    expect(tokens).toHaveLength(1);
    expect(tokens[0].token_hash).not.toBe(sesion.token_refresco);
    expect(tokens[0].token_hash).toHaveLength(64);
  });

  it('la sesion de un representante dura 12 horas', async () => {
    const antes = Date.now();
    const sesion = await servicio.iniciarSesion(
      'persona@ejemplo.cl',
      CONTRASENA,
    );
    const horas =
      (sesion.refresco_expira_en.getTime() - antes) / (60 * 60 * 1000);
    expect(horas).toBeGreaterThan(11.9);
    expect(horas).toBeLessThan(12.1);
  });

  it('responde lo mismo si el correo no existe o la contrasena es incorrecta', async () => {
    const capturar = (promesa: Promise<unknown>) =>
      promesa.then(() => null).catch((error: HttpException) => error);
    const errorCorreo = await capturar(
      servicio.iniciarSesion('nadie@ejemplo.cl', CONTRASENA),
    );
    const errorClave = await capturar(
      servicio.iniciarSesion('persona@ejemplo.cl', 'incorrecta'),
    );
    expect(errorCorreo?.getStatus()).toBe(401);
    expect(errorClave?.getStatus()).toBe(401);
    expect(errorCorreo?.message).toBe(errorClave?.message);
  });

  it('una cuenta desactivada no puede iniciar sesion', async () => {
    usuarios[0].activo = false;
    await expect(
      servicio.iniciarSesion('persona@ejemplo.cl', CONTRASENA),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('tras cinco fallos responde 429 aunque la contrasena sea correcta', async () => {
    for (let i = 0; i < 5; i++) {
      await expect(
        servicio.iniciarSesion('persona@ejemplo.cl', 'incorrecta'),
      ).rejects.toMatchObject({ status: 401 });
    }
    await expect(
      servicio.iniciarSesion('persona@ejemplo.cl', CONTRASENA),
    ).rejects.toMatchObject({ status: 429 });
  });

  it('renovar revoca el token usado, entrega otro y no alarga la sesion', async () => {
    const primera = await servicio.iniciarSesion(
      'persona@ejemplo.cl',
      CONTRASENA,
    );
    const segunda = await servicio.renovar(primera.token_refresco);
    expect(segunda.token_refresco).not.toBe(primera.token_refresco);
    expect(tokens[0].revocado_en).not.toBeNull();
    expect(tokens[1].revocado_en).toBeNull();
    expect(segunda.refresco_expira_en.getTime()).toBe(
      primera.refresco_expira_en.getTime(),
    );
  });

  it('reusar un token ya rotado cierra todas las sesiones de la cuenta', async () => {
    const primera = await servicio.iniciarSesion(
      'persona@ejemplo.cl',
      CONTRASENA,
    );
    const segunda = await servicio.renovar(primera.token_refresco);
    await expect(
      servicio.renovar(primera.token_refresco),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      servicio.renovar(segunda.token_refresco),
    ).rejects.toMatchObject({ status: 401 });
    expect(tokens.every((t) => t.revocado_en !== null)).toBe(true);
  });

  it('no renueva con un token vencido, inexistente o ausente', async () => {
    const sesion = await servicio.iniciarSesion(
      'persona@ejemplo.cl',
      CONTRASENA,
    );
    tokens[0].expira_en = new Date(Date.now() - 1000);
    await expect(servicio.renovar(sesion.token_refresco)).rejects.toMatchObject(
      { status: 401 },
    );
    await expect(servicio.renovar('token-inventado')).rejects.toMatchObject({
      status: 401,
    });
    await expect(servicio.renovar(undefined)).rejects.toMatchObject({
      status: 401,
    });
  });

  it('cerrar sesion revoca el token de refresco', async () => {
    const sesion = await servicio.iniciarSesion(
      'persona@ejemplo.cl',
      CONTRASENA,
    );
    await servicio.cerrarSesion(sesion.token_refresco);
    await expect(servicio.renovar(sesion.token_refresco)).rejects.toMatchObject(
      { status: 401 },
    );
  });

  it('registra un pasajero y rechaza un correo repetido', async () => {
    const datos = {
      nombre_completo: 'Nueva Persona',
      correo_electronico: 'nueva@ejemplo.cl',
      contrasena: CONTRASENA,
      acepta_terminos: true,
    };
    const creado = await servicio.registrarPasajero(datos);
    expect(creado.rol).toBe('pasajero');
    await expect(servicio.registrarPasajero(datos)).rejects.toMatchObject({
      status: 409,
    });
  });
});
