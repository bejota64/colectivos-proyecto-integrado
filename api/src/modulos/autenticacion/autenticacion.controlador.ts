import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Ip,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { Publico } from '../../comun/decoradores/publico.decorador';
import { AuditoriaServicio } from '../auditoria/auditoria.servicio';
import { AutenticacionServicio, type Sesion } from './autenticacion.servicio';
import { InicioSesionDto } from './dto/inicio-sesion.dto';
import { RegistroDto } from './dto/registro.dto';

export const COOKIE_REFRESCO = 'token_refresco';

/** 20 intentos por minuto por IP en las rutas que reciben credenciales. */
const LIMITE_CREDENCIALES = { default: { limit: 20, ttl: 60_000 } };

/**
 * HttpOnly: JavaScript no puede leer la cookie.
 * Secure: solo viaja por HTTPS (en produccion).
 * SameSite=Strict: otros sitios no pueden hacer que el navegador la envie.
 * path: el navegador solo la manda a las rutas de autenticacion.
 */
function opcionesDeCookie(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/autenticacion',
  };
}

/**
 * El controlador solo traduce HTTP: recibe datos ya validados, llama al
 * servicio y arma la respuesta. La cookie se maneja aqui para que el
 * servicio no dependa de Express.
 */
@Controller('autenticacion')
export class AutenticacionControlador {
  constructor(
    private readonly autenticacion: AutenticacionServicio,
    private readonly auditoria: AuditoriaServicio,
  ) {}

  @Publico()
  @Throttle(LIMITE_CREDENCIALES)
  @Post('registro')
  registrar(@Body() datos: RegistroDto) {
    return this.autenticacion.registrarPasajero(datos);
  }

  @Publico()
  @Throttle(LIMITE_CREDENCIALES)
  @HttpCode(200)
  @Post('inicio-sesion')
  async iniciarSesion(
    @Body() datos: InicioSesionDto,
    @Ip() ip: string,
    @Res({ passthrough: true }) respuesta: Response,
  ) {
    let sesion: Sesion;
    try {
      sesion = await this.autenticacion.iniciarSesion(
        datos.correo_electronico,
        datos.contrasena,
      );
    } catch (error) {
      // Evidencia de intentos de acceso ilicito (Ley 21.459). La IP vive en
      // la capa HTTP, por eso la auditoria de sesion se hace aqui y no en el
      // servicio. Nunca se guarda la contrasena intentada.
      if (error instanceof HttpException) {
        await this.auditoria.registrar({
          tipo: 'inicio_sesion_fallido',
          ip,
          detalle: {
            correo_intentado: datos.correo_electronico,
            motivo:
              error.getStatus() === Number(HttpStatus.TOO_MANY_REQUESTS)
                ? 'cuenta_bloqueada'
                : 'credenciales_invalidas',
          },
        });
      }
      throw error;
    }
    await this.auditoria.registrar({
      tipo: 'inicio_sesion_exitoso',
      usuarioId: sesion.usuario.id,
      ip,
    });
    return this.responderConSesion(respuesta, sesion);
  }

  @Publico()
  @HttpCode(200)
  @Post('renovar')
  async renovar(
    @Req() peticion: Request,
    @Res({ passthrough: true }) respuesta: Response,
  ) {
    const sesion = await this.autenticacion.renovar(this.leerCookie(peticion));
    return this.responderConSesion(respuesta, sesion);
  }

  @Publico()
  @HttpCode(204)
  @Post('cierre-sesion')
  async cerrarSesion(
    @Req() peticion: Request,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<void> {
    await this.autenticacion.cerrarSesion(this.leerCookie(peticion));
    respuesta.clearCookie(COOKIE_REFRESCO, opcionesDeCookie());
  }

  private leerCookie(peticion: Request): string | undefined {
    const cookies = peticion.cookies as Record<string, string> | undefined;
    return cookies?.[COOKIE_REFRESCO];
  }

  /** El token de refresco va SOLO en la cookie; el de acceso, en el cuerpo. */
  private responderConSesion(respuesta: Response, sesion: Sesion) {
    respuesta.cookie(COOKIE_REFRESCO, sesion.token_refresco, {
      ...opcionesDeCookie(),
      expires: sesion.refresco_expira_en,
    });
    return { token_acceso: sesion.token_acceso, usuario: sesion.usuario };
  }
}
