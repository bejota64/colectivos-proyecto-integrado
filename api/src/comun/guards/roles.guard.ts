import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CLAVE_PUBLICO } from '../decoradores/publico.decorador';
import { CLAVE_ROLES } from '../decoradores/roles.decorador';
import type { Rol, UsuarioSesion } from '../tipos';

/**
 * Guard global de roles. Corre despues de SesionGuard. Si la ruta declara
 * @Roles(...), el rol del usuario debe estar en la lista; si no, responde 403.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const destinos = [contexto.getHandler(), contexto.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, destinos)) {
      return true;
    }

    const rolesPermitidos = this.reflector.getAllAndOverride<Rol[] | undefined>(
      CLAVE_ROLES,
      destinos,
    );
    if (!rolesPermitidos || rolesPermitidos.length === 0) {
      return true;
    }

    const { usuario } = contexto
      .switchToHttp()
      .getRequest<{ usuario?: UsuarioSesion }>();
    if (!usuario || !rolesPermitidos.includes(usuario.rol)) {
      throw new ForbiddenException('No tienes permiso para esta accion');
    }
    return true;
  }
}
