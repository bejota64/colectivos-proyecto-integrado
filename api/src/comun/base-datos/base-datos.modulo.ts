import { Global, Module } from '@nestjs/common';
import { BaseDatosServicio } from './base-datos.servicio';

/** Global: cualquier modulo puede inyectar BaseDatosServicio sin importarlo. */
@Global()
@Module({
  providers: [BaseDatosServicio],
  exports: [BaseDatosServicio],
})
export class BaseDatosModulo {}
