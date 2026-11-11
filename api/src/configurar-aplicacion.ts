import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

/**
 * Configuracion comun a la API real y a las pruebas de integracion: asi
 * las pruebas ejercitan exactamente lo mismo que corre en produccion.
 */
export function configurarAplicacion(app: NestExpressApplication): void {
  // Detras del proxy inverso: confiar en UN salto para leer la IP real del cliente.
  app.set('trust proxy', 1);
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // descarta campos que el DTO no declara
      forbidNonWhitelisted: true, // y ademas responde 400 si llegan
      transform: true, // convierte el cuerpo en una instancia del DTO
    }),
  );

  // En produccion la web y la API salen del mismo dominio (Caddy), y no hace
  // falta CORS. Solo en desarrollo, si la web corre en otro puerto, se
  // permite ESE origen y ningun otro (nunca "*" con cookies).
  const origenWeb = app.get(ConfigService).get<string>('ORIGEN_WEB');
  if (origenWeb) {
    app.enableCors({ origin: origenWeb, credentials: true });
  }
}
