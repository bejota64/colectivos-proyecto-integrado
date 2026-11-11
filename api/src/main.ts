import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configurarAplicacion } from './configurar-aplicacion';

async function iniciar(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configurarAplicacion(app);
  const puerto = app.get(ConfigService).getOrThrow<number>('PUERTO');
  await app.listen(puerto);
}

void iniciar();
