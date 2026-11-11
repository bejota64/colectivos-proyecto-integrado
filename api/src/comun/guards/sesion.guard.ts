import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { UsuariosRepositorio } from '../../modulos/usuarios/usuarios.repositorio';
import { CLAVE_PUBLICO } from '../decoradores/publico.decorador';
import type { UsuarioSesion } from '../tipos';

/**
 * Guard global de sesion. Se ejecuta en TODAS las rutas:
 *  1. Si la ruta esta marcada con @Publico(), deja pasar.
 *  2. Exige un token de acceso valido en el encabezado Authorization.
 *  3. Comprueba en la base que la cuenta exista y siga activa.
 * El rol se toma de la base y no del token: un cambio de rol o una
 * desactivacion tienen efecto inmediato.
 */
@Injectable()
export class SesionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly usuarios: UsuariosRepositorio,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const esPublico = this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (esPublico) {
      return true;
    }

    const peticion = contexto
      .switchToHttp()
      .getRequest<Request & { usuario?: UsuarioSesion }>();
    const token = this.extraerToken(peticion);
    if (!token) {
      throw new UnauthorizedException('Sesion requerida');
    }

    let idUsuario: string;
    try {
      const contenido = await this.jwt.verifyAsync<{ sub: string }>(token);
      idUsuario = contenido.sub;
    } catch {
      throw new UnauthorizedException('Sesion invalida o vencida');
    }

    const usuario = await this.usuarios.buscarPorId(idUsuario);
    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Sesion invalida o vencida');
    }

    peticion.usuario = { id: usuario.id, rol: usuario.rol };
    return true;
  }

  private extraerToken(peticion: Request): string | null {
    const [tipo, token] = peticion.headers.authorization?.split(' ') ?? [];
    return tipo === 'Bearer' && token ? token : null;
  }
}
