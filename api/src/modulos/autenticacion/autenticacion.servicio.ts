import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { Rol } from '../../comun/tipos';
import {
  UsuarioFila,
  UsuariosRepositorio,
} from '../usuarios/usuarios.repositorio';
import { ContrasenasServicio } from './contrasenas.servicio';
import { RegistroDto } from './dto/registro.dto';
import { IntentosServicio } from './intentos.servicio';
import { TokensRepositorio } from './tokens.repositorio';

const HORA_MS = 60 * 60 * 1000;
const DIA_MS = 24 * HORA_MS;

/** Duracion maxima de la sesion segun el rol: mas privilegio, menos tiempo. */
const DURACION_SESION_MS: Record<Rol, number> = {
  pasajero: 30 * DIA_MS,
  conductor: 7 * DIA_MS,
  representante: 12 * HORA_MS,
  administrador: 12 * HORA_MS,
};

const VERSION_POLITICA = '1.0';
/** Un solo mensaje para correo inexistente y contrasena incorrecta: no revela que correos tienen cuenta. */
const MENSAJE_CREDENCIALES = 'Correo o contraseña incorrectos';
const MENSAJE_SESION = 'Sesion invalida o vencida';

export interface UsuarioPublico {
  id: string;
  nombre_completo: string;
  correo_electronico: string;
  rol: Rol;
}

export interface Sesion {
  token_acceso: string;
  token_refresco: string;
  refresco_expira_en: Date;
  usuario: UsuarioPublico;
}

/** El token de refresco se guarda y se busca siempre por su hash SHA-256. */
export function hashDeToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function aPublico(usuario: UsuarioFila): UsuarioPublico {
  return {
    id: usuario.id,
    nombre_completo: usuario.nombre_completo,
    correo_electronico: usuario.correo_electronico,
    rol: usuario.rol,
  };
}

@Injectable()
export class AutenticacionServicio {
  constructor(
    private readonly usuarios: UsuariosRepositorio,
    private readonly tokens: TokensRepositorio,
    private readonly contrasenas: ContrasenasServicio,
    private readonly intentos: IntentosServicio,
    private readonly jwt: JwtService,
  ) {}

  async registrarPasajero(datos: RegistroDto): Promise<UsuarioPublico> {
    const motivo = this.contrasenas.revisarPolitica(
      datos.contrasena,
      'pasajero',
    );
    if (motivo) {
      throw new BadRequestException(motivo);
    }

    const usuario = await this.usuarios.crearPasajero({
      nombreCompleto: datos.nombre_completo,
      correo: datos.correo_electronico,
      contrasenaHash: await this.contrasenas.generarHash(datos.contrasena),
      versionPolitica: VERSION_POLITICA,
    });
    if (!usuario) {
      throw new ConflictException(
        'No fue posible crear la cuenta con esos datos',
      );
    }
    return aPublico(usuario);
  }

  async iniciarSesion(correo: string, contrasena: string): Promise<Sesion> {
    if (this.intentos.estaBloqueada(correo)) {
      throw new HttpException(
        'Demasiados intentos. Intenta de nuevo mas tarde',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const usuario = await this.usuarios.buscarPorCorreo(correo);
    const coincide = await this.contrasenas.coincide(
      contrasena,
      usuario?.contrasena_hash ?? null,
    );
    if (!usuario || !usuario.activo || !coincide) {
      this.intentos.registrarFallo(correo);
      throw new UnauthorizedException(MENSAJE_CREDENCIALES);
    }

    this.intentos.limpiar(correo);
    const expiraEn = new Date(Date.now() + DURACION_SESION_MS[usuario.rol]);
    return this.abrirSesion(usuario, expiraEn);
  }

  /**
   * Rotacion: cada renovacion revoca el token usado y entrega uno nuevo.
   * Si llega un token ya revocado, alguien lo copio: se cierran todas las
   * sesiones de esa cuenta.
   */
  async renovar(tokenRefresco: string | undefined): Promise<Sesion> {
    if (!tokenRefresco) {
      throw new UnauthorizedException(MENSAJE_SESION);
    }

    const guardado = await this.tokens.buscarPorHash(
      hashDeToken(tokenRefresco),
    );
    if (!guardado) {
      throw new UnauthorizedException(MENSAJE_SESION);
    }
    if (guardado.revocado_en !== null) {
      await this.tokens.revocarTodosDeUsuario(guardado.usuario_id);
      throw new UnauthorizedException(MENSAJE_SESION);
    }
    if (guardado.expira_en.getTime() <= Date.now()) {
      throw new UnauthorizedException(MENSAJE_SESION);
    }

    const loRevoqueYo = await this.tokens.revocar(guardado.id);
    if (!loRevoqueYo) {
      await this.tokens.revocarTodosDeUsuario(guardado.usuario_id);
      throw new UnauthorizedException(MENSAJE_SESION);
    }

    const usuario = await this.usuarios.buscarPorId(guardado.usuario_id);
    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException(MENSAJE_SESION);
    }

    // El token nuevo hereda la fecha limite: renovar no alarga la sesion.
    return this.abrirSesion(usuario, guardado.expira_en);
  }

  async cerrarSesion(tokenRefresco: string | undefined): Promise<void> {
    if (!tokenRefresco) {
      return;
    }
    const guardado = await this.tokens.buscarPorHash(
      hashDeToken(tokenRefresco),
    );
    if (guardado) {
      await this.tokens.revocar(guardado.id);
    }
  }

  private async abrirSesion(
    usuario: UsuarioFila,
    expiraEn: Date,
  ): Promise<Sesion> {
    const tokenRefresco = randomBytes(32).toString('base64url');
    await this.tokens.crear({
      usuarioId: usuario.id,
      tokenHash: hashDeToken(tokenRefresco),
      expiraEn,
    });

    return {
      token_acceso: await this.jwt.signAsync({
        sub: usuario.id,
        rol: usuario.rol,
      }),
      token_refresco: tokenRefresco,
      refresco_expira_en: expiraEn,
      usuario: aPublico(usuario),
    };
  }
}
