import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UsuarioSesion } from '../tipos';

/** Entrega al controlador el usuario que SesionGuard dejo en la peticion. */
export const UsuarioActual = createParamDecorator(
  (_dato: unknown, contexto: ExecutionContext): UsuarioSesion => {
    const peticion = contexto
      .switchToHttp()
      .getRequest<{ usuario: UsuarioSesion }>();
    return peticion.usuario;
  },
);
