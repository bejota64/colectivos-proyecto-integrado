import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuditoriaServicio } from '../../modulos/auditoria/auditoria.servicio';
import type { UsuarioSesion } from '../tipos';

const MENSAJE_INTERNO = 'Ocurrio un error interno. Intenta de nuevo mas tarde';

/**
 * Filtro global de errores (OWASP A10:2025, manejo de condiciones
 * excepcionales). Hace tres cosas:
 *  1. Los errores HTTP previstos (400, 401, 403, 404, 409, 422, 429, 503) salen
 *     tal cual: los mensajes los escribimos nosotros.
 *  2. Cualquier otro error (una caida de la base, un bug) responde 500 con
 *     un mensaje generico. El detalle y la traza quedan SOLO en el log del
 *     servidor: el cliente nunca ve SQL, rutas de archivos ni versiones.
 *  3. Cada 403 queda en la auditoria como "acceso_denegado".
 */
@Catch()
export class ErroresFiltro implements ExceptionFilter {
  private readonly log = new Logger(ErroresFiltro.name);

  constructor(private readonly auditoria: AuditoriaServicio) {}

  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const peticion = http.getRequest<Request & { usuario?: UsuarioSesion }>();
    const respuesta = http.getResponse<Response>();

    if (error instanceof HttpException) {
      const estado = error.getStatus();
      if (estado === Number(HttpStatus.FORBIDDEN)) {
        void this.auditoria.registrar({
          tipo: 'acceso_denegado',
          usuarioId: peticion.usuario?.id,
          ip: peticion.ip,
          detalle: { metodo: peticion.method, ruta: peticion.path },
        });
      }
      respuesta.status(estado).json(error.getResponse());
      return;
    }

    this.log.error(
      `${peticion.method} ${peticion.path}: ${(error as Error)?.message}`,
      (error as Error)?.stack,
    );
    respuesta.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: MENSAJE_INTERNO,
    });
  }
}
